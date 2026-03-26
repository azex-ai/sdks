package cmd

import (
	"fmt"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var transactionsCmd = &cobra.Command{
	Use:   "transactions",
	Short: "View transaction history",
}

var transactionsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List recent transactions",
	RunE:  runTransactionsList,
}

var (
	txPage int
	txSize int
)

func init() {
	transactionsListCmd.Flags().IntVar(&txPage, "page", 1, "Page number")
	transactionsListCmd.Flags().IntVar(&txSize, "size", 20, "Items per page")
	transactionsCmd.AddCommand(transactionsListCmd)
}

type transaction struct {
	UID         string `json:"uid"`
	Type        string `json:"type"`
	Amount      string `json:"amount"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
}

type transactionsResponse struct {
	Data       []transaction `json:"data"`
	TotalCount int           `json:"total_count"`
	Page       int           `json:"page"`
	PageSize   int           `json:"page_size"`
}

func runTransactionsList(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	path := fmt.Sprintf("/api/v1/billing/transactions?page=%d&page_size=%d", txPage, txSize)
	var resp transactionsResponse
	if err := c.Get(cmd.Context(), path, &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	if len(resp.Data) == 0 {
		fmt.Println("No transactions found.")
		return nil
	}

	t := output.NewTable("DATE", "TYPE", "AMOUNT", "DESCRIPTION")
	for _, tx := range resp.Data {
		date := formatTime(tx.CreatedAt)
		txType := colorTxType(tx.Type)
		amount := colorAmount(tx.Amount, tx.Type)
		desc := output.Dim(truncate(tx.Description, 50))
		t.AddRow(date, txType, amount, desc)
	}
	t.Flush()

	if resp.TotalCount > 0 {
		fmt.Printf("\n%s\n", output.Dim(fmt.Sprintf("Page %d — %d total transactions", resp.Page, resp.TotalCount)))
	}
	return nil
}

func colorTxType(t string) string {
	switch strings.ToLower(t) {
	case "deposit", "credit":
		return output.Green(t)
	case "llm_consume", "debit":
		return output.Yellow(t)
	case "refund":
		return output.Cyan(t)
	default:
		return output.Dim(t)
	}
}

func colorAmount(amount, txType string) string {
	switch strings.ToLower(txType) {
	case "deposit", "credit", "refund":
		return output.Green("+" + amount)
	default:
		return output.Yellow("-" + amount)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}
