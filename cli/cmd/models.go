package cmd

import (
	"fmt"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var modelsCmd = &cobra.Command{
	Use:   "models",
	Short: "Browse available LLM models",
}

var modelsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all available models",
	RunE:  runModelsList,
}

var modelsInfoCmd = &cobra.Command{
	Use:   "info <model>",
	Short: "Show detailed information about a model",
	Args:  cobra.ExactArgs(1),
	RunE:  runModelsInfo,
}

var (
	modelsCapability string
	modelsSort       string
)

func init() {
	modelsListCmd.Flags().StringVar(&modelsCapability, "capability", "", "Filter by capability (chat, vision, embedding)")
	modelsListCmd.Flags().StringVar(&modelsSort, "sort", "name", "Sort by (name, price, context)")
	modelsCmd.AddCommand(modelsListCmd, modelsInfoCmd)
}

type modelInfo struct {
	UID            string   `json:"uid"`
	Name           string   `json:"name"`
	ContextLength  int      `json:"context_length"`
	InputPrice     string   `json:"input_price_per_million"`
	OutputPrice    string   `json:"output_price_per_million"`
	Capabilities   []string `json:"capabilities"`
	IsFree         bool     `json:"is_free"`
}

type modelsResponse struct {
	Data []modelInfo `json:"data"`
}

func runModelsList(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp modelsResponse
	if err := c.Get(cmd.Context(), "/api/v1/models", &resp); err != nil {
		return formatAPIError(err)
	}

	models := resp.Data
	if modelsCapability != "" {
		filtered := models[:0]
		for _, m := range models {
			for _, cap := range m.Capabilities {
				if strings.EqualFold(cap, modelsCapability) {
					filtered = append(filtered, m)
					break
				}
			}
		}
		models = filtered
	}

	if output.IsJSON() {
		return output.PrintJSON(models)
	}

	if len(models) == 0 {
		fmt.Println("No models found.")
		return nil
	}

	t := output.NewTable("MODEL", "CONTEXT", "INPUT $/M", "OUTPUT $/M", "CAPABILITIES")
	for _, m := range models {
		ctx := formatContext(m.ContextLength)
		inputP := m.InputPrice
		outputP := m.OutputPrice
		if m.IsFree {
			inputP = output.Green("free")
			outputP = output.Green("free")
		}
		caps := strings.Join(m.Capabilities, ", ")
		t.AddRow(output.Cyan(m.UID), ctx, inputP, outputP, output.Dim(caps))
	}
	t.Flush()
	fmt.Printf("\n%s\n", output.Dim(fmt.Sprintf("%d models", len(models))))
	return nil
}

func runModelsInfo(cmd *cobra.Command, args []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp modelsResponse
	if err := c.Get(cmd.Context(), "/api/v1/models", &resp); err != nil {
		return formatAPIError(err)
	}

	target := args[0]
	for _, m := range resp.Data {
		if m.UID == target || m.Name == target {
			if output.IsJSON() {
				return output.PrintJSON(m)
			}
			printModelDetail(m)
			return nil
		}
	}
	return fmt.Errorf("model %q not found", target)
}

func printModelDetail(m modelInfo) {
	fmt.Printf("%s\n\n", output.CyanBold(m.UID))
	fmt.Printf("  %-18s %s\n", "Name:", m.Name)
	fmt.Printf("  %-18s %s\n", "Context:", formatContext(m.ContextLength))
	if m.IsFree {
		fmt.Printf("  %-18s %s\n", "Pricing:", output.Green("Free"))
	} else {
		fmt.Printf("  %-18s $%s / M tokens\n", "Input price:", m.InputPrice)
		fmt.Printf("  %-18s $%s / M tokens\n", "Output price:", m.OutputPrice)
	}
	fmt.Printf("  %-18s %s\n", "Capabilities:", strings.Join(m.Capabilities, ", "))
}

func formatContext(n int) string {
	if n == 0 {
		return "—"
	}
	if n >= 1_000_000 {
		return fmt.Sprintf("%dM", n/1_000_000)
	}
	if n >= 1_000 {
		return fmt.Sprintf("%dk", n/1_000)
	}
	return fmt.Sprintf("%d", n)
}
