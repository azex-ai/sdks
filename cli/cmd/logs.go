package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Stream real-time request logs",
}

var logsTailCmd = &cobra.Command{
	Use:   "tail",
	Short: "Stream request logs in real-time (polls every 2s)",
	Long: `Stream request logs in real-time, similar to stripe logs tail.

  14:30:05 ✓ openai/gpt-4o      chat     500→250 tok  $0.0075  2.3s
  14:30:08 ✓ deepseek/deepseek  chat     200→100 tok  $0.0003  0.8s`,
	RunE: runLogsTail,
}

var (
	tailModel  string
	tailStatus string
)

func init() {
	logsTailCmd.Flags().StringVar(&tailModel, "model", "", "Filter by model name")
	logsTailCmd.Flags().StringVar(&tailStatus, "status", "", "Filter by status (success, error)")
	logsCmd.AddCommand(logsTailCmd)
}

func runLogsTail(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(cmd.Context())
	defer cancel()

	// Handle Ctrl+C gracefully
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sig
		cancel()
	}()

	fmt.Printf("%s Streaming request logs... %s\n\n",
		output.CyanBold("azex logs tail"),
		output.Dim("(Ctrl+C to stop)"))

	c := client.New(cfg.ResolvedBaseURL(), key)

	var lastSeenUID string
	var seenUIDs = make(map[string]bool)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	// Do an initial fetch immediately
	if err := fetchAndPrintLogs(ctx, c, &lastSeenUID, seenUIDs); err != nil && ctx.Err() == nil {
		output.PrintWarning(fmt.Sprintf("fetch error: %v", err))
	}

	for {
		select {
		case <-ctx.Done():
			fmt.Println(output.Dim("\nStopped."))
			return nil
		case <-ticker.C:
			if err := fetchAndPrintLogs(ctx, c, &lastSeenUID, seenUIDs); err != nil && ctx.Err() == nil {
				output.PrintWarning(fmt.Sprintf("fetch error: %v", err))
			}
		}
	}
}

func fetchAndPrintLogs(ctx context.Context, c *client.Client, lastUID *string, seen map[string]bool) error {
	path := "/api/v1/usage/logs?page=1&page_size=20"
	if tailModel != "" {
		path += "&model=" + tailModel
	}

	var resp logsResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return err
	}

	// Collect new entries in reverse order (oldest first)
	var newLogs []requestLog
	for i := len(resp.Data) - 1; i >= 0; i-- {
		log := resp.Data[i]
		if !seen[log.UID] {
			// Apply status filter
			if tailStatus != "" && !matchesStatus(log.Status, tailStatus) {
				continue
			}
			newLogs = append(newLogs, log)
			seen[log.UID] = true
		}
	}

	for _, log := range newLogs {
		printLogLine(log)
		*lastUID = log.UID
	}

	return nil
}

func printLogLine(log requestLog) {
	timeStr := formatLogTime(log.CreatedAt)
	statusIcon := output.Green("✓")
	if isErrorStatus(log.Status) {
		statusIcon = output.Red("✗")
	}

	model := output.Cyan(padRight(truncate(log.Model, 28), 28))
	tokens := fmt.Sprintf("%d→%d tok", log.PromptTokens, log.CompletionTokens)
	cost := "$" + log.Cost
	dur := formatDuration(log.DurationMs)

	if isErrorStatus(log.Status) && log.ErrorMessage != nil {
		fmt.Printf("%s %s %-28s  %-8s  %-6s  %-10s  %s\n",
			output.Dim(timeStr), statusIcon, model,
			output.Red("error"), output.Dim("—"), output.Dim("—"),
			output.Red(truncate(*log.ErrorMessage, 40)))
	} else {
		fmt.Printf("%s %s %s  %-8s  %-12s  %-10s  %s\n",
			output.Dim(timeStr), statusIcon, model,
			output.Dim("chat"),
			output.Dim(tokens),
			output.Yellow(cost),
			output.Dim(dur))
	}
}

func isErrorStatus(status string) bool {
	s := strings.ToLower(status)
	return s == "error" || s == "failed"
}

func matchesStatus(logStatus, filter string) bool {
	switch strings.ToLower(filter) {
	case "success":
		return !isErrorStatus(logStatus)
	case "error":
		return isErrorStatus(logStatus)
	default:
		return strings.EqualFold(logStatus, filter)
	}
}

func padRight(s string, n int) string {
	if len(s) >= n {
		return s
	}
	return s + strings.Repeat(" ", n-len(s))
}
