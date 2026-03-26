package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var chatCmd = &cobra.Command{
	Use:   "chat [prompt]",
	Short: "Chat with an LLM model",
	Long: `Send a message to an LLM and stream the response.

Examples:
  azex chat "What is the capital of France?"
  echo "Explain quicksort" | azex chat
  azex chat -m openai/gpt-4o "Write a haiku"
  azex chat  # interactive mode`,
	RunE: runChat,
}

var (
	chatModel       string
	chatSystem      string
	chatMaxTokens   int
	chatTemperature float64
	chatNoStream    bool
)

func init() {
	chatCmd.Flags().StringVarP(&chatModel, "model", "m", "", "Model to use (default: config default_model or openai/gpt-4o)")
	chatCmd.Flags().StringVarP(&chatSystem, "system", "s", "", "System prompt")
	chatCmd.Flags().IntVar(&chatMaxTokens, "max-tokens", 0, "Maximum tokens in response")
	chatCmd.Flags().Float64Var(&chatTemperature, "temperature", -1, "Sampling temperature (0.0-2.0)")
	chatCmd.Flags().BoolVar(&chatNoStream, "no-stream", false, "Disable streaming (wait for full response)")
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model            string        `json:"model"`
	Messages         []chatMessage `json:"messages"`
	Stream           bool          `json:"stream"`
	MaxTokens        *int          `json:"max_tokens,omitempty"`
	Temperature      *float64      `json:"temperature,omitempty"`
	StreamOptions    *streamOpts   `json:"stream_options,omitempty"`
}

type streamOpts struct {
	IncludeUsage bool `json:"include_usage"`
}

type chatResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		Message      chatMessage `json:"message"`
		FinishReason string      `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

func runChat(cmd *cobra.Command, args []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	model := chatModel
	if model == "" {
		model = cfg.DefaultModel
	}
	if model == "" {
		model = "openai/gpt-4o"
	}

	// Determine prompt source
	var prompt string
	stdinIsTTY := term.IsTerminal(int(os.Stdin.Fd()))

	if len(args) > 0 {
		prompt = strings.Join(args, " ")
		return runSingleTurn(cmd.Context(), key, model, prompt, false)
	}

	if !stdinIsTTY {
		// Piped input
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return fmt.Errorf("read stdin: %w", err)
		}
		prompt = strings.TrimSpace(string(data))
		if prompt == "" {
			return fmt.Errorf("empty prompt from stdin")
		}
		return runSingleTurn(cmd.Context(), key, model, prompt, false)
	}

	// Interactive mode
	return runInteractive(cmd.Context(), key, model)
}

func buildRequest(model, prompt string, history []chatMessage, stream bool) chatRequest {
	messages := make([]chatMessage, 0, len(history)+1)
	if chatSystem != "" {
		messages = append(messages, chatMessage{Role: "system", Content: chatSystem})
	}
	messages = append(messages, history...)
	messages = append(messages, chatMessage{Role: "user", Content: prompt})

	req := chatRequest{
		Model:    model,
		Messages: messages,
		Stream:   stream,
	}

	if chatMaxTokens > 0 {
		req.MaxTokens = &chatMaxTokens
	}
	if chatTemperature >= 0 {
		req.Temperature = &chatTemperature
	}
	if stream {
		req.StreamOptions = &streamOpts{IncludeUsage: true}
	}
	return req
}

func runSingleTurn(ctx context.Context, key, model, prompt string, silent bool) error {
	stream := !chatNoStream && !output.IsJSON()

	req := buildRequest(model, prompt, nil, stream)

	if stream {
		return runStream(ctx, key, req, silent)
	}
	return runSync(ctx, key, req)
}

func runStream(ctx context.Context, key string, req chatRequest, silent bool) error {
	c := client.NewStreaming(cfg.ResolvedBaseURL(), key)
	resp, err := c.Stream(ctx, "/v1/chat/completions", req)
	if err != nil {
		return formatAPIError(err)
	}
	defer resp.Body.Close()

	cost := resp.Header.Get("X-Request-Cost")
	reader := client.NewSSEReader(resp.Body)

	var finalUsage *client.StreamUsage
	for {
		event, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		chunk, err := client.ParseChunk(event.Data)
		if err != nil {
			continue
		}

		if chunk.Usage != nil {
			finalUsage = chunk.Usage
		}

		delta := client.ContentDelta(chunk)
		if delta != "" && !silent {
			fmt.Print(delta)
		}
	}

	if !silent {
		fmt.Println() // newline after streamed content
		printUsageLine(finalUsage, cost)
	}
	return nil
}

func runSync(ctx context.Context, key string, req chatRequest) error {
	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp chatResponse
	if err := c.Post(ctx, "/v1/chat/completions", req, &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	if len(resp.Choices) == 0 {
		return fmt.Errorf("empty response from API")
	}

	fmt.Println(resp.Choices[0].Message.Content)
	printSyncUsage(&resp)
	return nil
}

func printUsageLine(usage *client.StreamUsage, cost string) {
	if usage == nil && cost == "" {
		return
	}
	parts := []string{}
	if usage != nil {
		parts = append(parts, fmt.Sprintf("%d→%d tok", usage.PromptTokens, usage.CompletionTokens))
	}
	if cost != "" {
		parts = append(parts, fmt.Sprintf("$%s", cost))
	}
	if len(parts) > 0 {
		fmt.Println(output.Dim("  " + strings.Join(parts, "  ")))
	}
}

func printSyncUsage(resp *chatResponse) {
	u := resp.Usage
	if u.TotalTokens > 0 {
		fmt.Println(output.Dim(fmt.Sprintf("  %d→%d tok  (total: %d)", u.PromptTokens, u.CompletionTokens, u.TotalTokens)))
	}
}

func runInteractive(ctx context.Context, key, model string) error {
	fmt.Printf("%s Chatting with %s  (Ctrl+D to exit)\n\n", output.Cyan("azex"), output.CyanBold(model))

	scanner := bufio.NewScanner(os.Stdin)
	var history []chatMessage

	for {
		fmt.Printf("%s ", output.Bold("You:"))
		if !scanner.Scan() {
			fmt.Println()
			break
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		fmt.Printf("\n%s ", output.GreenBold("Assistant:"))

		req := buildRequest(model, line, history, true)
		c := client.NewStreaming(cfg.ResolvedBaseURL(), key)
		resp, err := c.Stream(ctx, "/v1/chat/completions", req)
		if err != nil {
			fmt.Println(output.Red(formatAPIError(err).Error()))
			continue
		}

		reader := client.NewSSEReader(resp.Body)
		var fullContent strings.Builder
		var finalUsage *client.StreamUsage

		for {
			event, err := reader.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			chunk, err := client.ParseChunk(event.Data)
			if err != nil {
				continue
			}
			if chunk.Usage != nil {
				finalUsage = chunk.Usage
			}
			delta := client.ContentDelta(chunk)
			if delta != "" {
				fmt.Print(delta)
				fullContent.WriteString(delta)
			}
		}
		resp.Body.Close()

		fmt.Println()
		cost := resp.Header.Get("X-Request-Cost")
		printUsageLine(finalUsage, cost)
		fmt.Println()

		// Append to history
		history = append(history,
			chatMessage{Role: "user", Content: line},
			chatMessage{Role: "assistant", Content: fullContent.String()},
		)
	}

	fmt.Println(output.Dim("Goodbye!"))
	return nil
}

func formatAPIError(err error) error {
	if apiErr, ok := err.(*client.APIError); ok {
		// Try to extract a message from the JSON body
		var body struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
			} `json:"error"`
			Message string `json:"message"`
		}
		if json.Unmarshal([]byte(apiErr.Body), &body) == nil {
			msg := body.Error.Message
			if msg == "" {
				msg = body.Message
			}
			if msg != "" {
				return fmt.Errorf("API error %d: %s", apiErr.StatusCode, msg)
			}
		}
	}
	return err
}
