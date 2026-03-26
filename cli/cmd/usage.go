package cmd

import (
	"fmt"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var usageCmd = &cobra.Command{
	Use:   "usage",
	Short: "View usage statistics and request logs",
}

var usageStatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show usage statistics",
	RunE:  runUsageStats,
}

var usageLogsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Show request logs",
	RunE:  runUsageLogs,
}

var (
	usageFrom  string
	usageTo    string
	usageModel string
	usageLogPage int
	usageLogSize int
)

func init() {
	usageStatsCmd.Flags().StringVar(&usageFrom, "from", "", "Start date (YYYY-MM-DD)")
	usageStatsCmd.Flags().StringVar(&usageTo, "to", "", "End date (YYYY-MM-DD)")

	usageLogsCmd.Flags().StringVar(&usageFrom, "from", "", "Start date (YYYY-MM-DD)")
	usageLogsCmd.Flags().StringVar(&usageTo, "to", "", "End date (YYYY-MM-DD)")
	usageLogsCmd.Flags().StringVar(&usageModel, "model", "", "Filter by model")
	usageLogsCmd.Flags().IntVar(&usageLogPage, "page", 1, "Page number")
	usageLogsCmd.Flags().IntVar(&usageLogSize, "size", 20, "Items per page")

	usageCmd.AddCommand(usageStatsCmd, usageLogsCmd)
}

type usageStats struct {
	TotalRequests    int    `json:"total_requests"`
	SuccessRequests  int    `json:"success_requests"`
	ErrorRequests    int    `json:"error_requests"`
	TotalTokens      int    `json:"total_tokens"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	TotalCost        string `json:"total_cost"`
}

type requestLog struct {
	UID              string  `json:"uid"`
	Model            string  `json:"model"`
	Status           string  `json:"status"`
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	Cost             string  `json:"cost"`
	DurationMs       int     `json:"duration_ms"`
	CreatedAt        string  `json:"created_at"`
	ErrorMessage     *string `json:"error_message"`
}

type logsResponse struct {
	Data       []requestLog `json:"data"`
	TotalCount int          `json:"total_count"`
	Page       int          `json:"page"`
	PageSize   int          `json:"page_size"`
}

func runUsageStats(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	path := "/api/v1/usage"
	params := buildDateParams(usageFrom, usageTo)
	if params != "" {
		path += "?" + params
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var stats usageStats
	if err := c.Get(cmd.Context(), path, &stats); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(stats)
	}

	fmt.Printf("  %-22s %s\n", "Total requests:", output.Bold(fmt.Sprintf("%d", stats.TotalRequests)))
	fmt.Printf("  %-22s %s / %s\n", "Success / Error:",
		output.Green(fmt.Sprintf("%d", stats.SuccessRequests)),
		output.Red(fmt.Sprintf("%d", stats.ErrorRequests)))
	fmt.Printf("  %-22s %s (in: %d, out: %d)\n", "Total tokens:",
		output.Bold(fmt.Sprintf("%d", stats.TotalTokens)),
		stats.PromptTokens, stats.CompletionTokens)
	fmt.Printf("  %-22s %s\n", "Total cost:", output.GreenBold("$"+stats.TotalCost))
	return nil
}

func runUsageLogs(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/api/v1/usage/logs?page=%d&page_size=%d", usageLogPage, usageLogSize)
	if usageFrom != "" {
		path += "&from=" + usageFrom
	}
	if usageTo != "" {
		path += "&to=" + usageTo
	}
	if usageModel != "" {
		path += "&model=" + usageModel
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp logsResponse
	if err := c.Get(cmd.Context(), path, &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	if len(resp.Data) == 0 {
		fmt.Println("No request logs found.")
		return nil
	}

	t := output.NewTable("TIME", "MODEL", "STATUS", "TOKENS", "COST", "DURATION")
	for _, log := range resp.Data {
		timeStr := formatLogTime(log.CreatedAt)
		model := output.Cyan(truncate(log.Model, 30))
		status := colorLogStatus(log.Status)
		tokens := fmt.Sprintf("%d→%d", log.PromptTokens, log.CompletionTokens)
		cost := "$" + log.Cost
		dur := formatDuration(log.DurationMs)
		t.AddRow(timeStr, model, status, tokens, cost, dur)
	}
	t.Flush()

	if resp.TotalCount > 0 {
		fmt.Printf("\n%s\n", output.Dim(fmt.Sprintf("Page %d — %d total logs", resp.Page, resp.TotalCount)))
	}
	return nil
}

func buildDateParams(from, to string) string {
	var parts []string
	if from != "" {
		parts = append(parts, "from="+from)
	}
	if to != "" {
		parts = append(parts, "to="+to)
	}
	return strings.Join(parts, "&")
}

func formatLogTime(t string) string {
	// Extract HH:MM:SS from RFC3339 or similar
	if len(t) >= 19 {
		// "2024-01-15T14:30:05..."
		if idx := strings.Index(t, "T"); idx != -1 && idx+9 <= len(t) {
			return t[idx+1 : idx+9]
		}
	}
	return formatTime(t)
}

func colorLogStatus(status string) string {
	switch strings.ToLower(status) {
	case "success", "completed", "200":
		return output.Green("✓")
	case "error", "failed":
		return output.Red("✗")
	default:
		return output.Yellow(status)
	}
}

func formatDuration(ms int) string {
	if ms == 0 {
		return "—"
	}
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	}
	return fmt.Sprintf("%.1fs", float64(ms)/1000)
}
