package cmd

import (
	"fmt"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var depositCmd = &cobra.Command{
	Use:   "deposit",
	Short: "View deposit address and manage deposits",
}

var depositInfoCmd = &cobra.Command{
	Use:   "info",
	Short: "Show your deposit address",
	RunE:  runDepositInfo,
}

var depositRefreshCmd = &cobra.Command{
	Use:   "refresh",
	Short: "Trigger a blockchain scan for your deposit address",
	RunE:  runDepositRefresh,
}

func init() {
	depositCmd.AddCommand(depositInfoCmd, depositRefreshCmd)
}

type chainInfo struct {
	ChainID   int    `json:"chain_id"`
	Name      string `json:"name"`
	Network   string `json:"network"`
}

type recentDeposit struct {
	TxHash    string `json:"tx_hash"`
	Amount    string `json:"amount"`
	Token     string `json:"token"`
	Chain     string `json:"chain"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type depositResponse struct {
	Address        string          `json:"address"`
	Chains         []chainInfo     `json:"chains"`
	Tokens         []string        `json:"tokens"`
	RecentDeposits []recentDeposit `json:"recent_deposits"`
}

type depositRefreshResponse struct {
	Message string `json:"message"`
}

func runDepositInfo(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp depositResponse
	if err := c.Get(cmd.Context(), "/api/v1/deposit", &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	fmt.Printf("\n  %s\n", output.Bold("Deposit Address"))
	fmt.Printf("  %s\n\n", output.CyanBold(resp.Address))
	fmt.Println(output.Dim("  Same address works across all supported chains."))

	if len(resp.Chains) > 0 {
		fmt.Printf("\n  %s\n", output.Bold("Supported Networks"))
		for _, chain := range resp.Chains {
			fmt.Printf("    • %s %s\n", chain.Name, output.Dim(fmt.Sprintf("(Chain ID: %d)", chain.ChainID)))
		}
	}

	if len(resp.Tokens) > 0 {
		fmt.Printf("\n  %s\n", output.Bold("Accepted Tokens"))
		fmt.Printf("    %s\n", strings.Join(resp.Tokens, ", "))
	}

	if len(resp.RecentDeposits) > 0 {
		fmt.Printf("\n  %s\n", output.Bold("Recent Deposits"))
		t := output.NewTable("DATE", "AMOUNT", "TOKEN", "CHAIN", "STATUS")
		for _, d := range resp.RecentDeposits {
			t.AddRow(
				formatTime(d.CreatedAt),
				output.Green(d.Amount),
				d.Token,
				d.Chain,
				colorDepositStatus(d.Status),
			)
		}
		t.Flush()
	}

	fmt.Printf("\n%s\n", output.Dim("  Run `azex deposit refresh` to trigger an on-chain scan."))
	return nil
}

func runDepositRefresh(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp depositRefreshResponse
	if err := c.Post(cmd.Context(), "/api/v1/deposit/refresh", nil, &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	msg := resp.Message
	if msg == "" {
		msg = "Scan triggered successfully"
	}
	output.PrintSuccess(msg)
	return nil
}

func colorDepositStatus(status string) string {
	switch strings.ToLower(status) {
	case "confirmed", "success":
		return output.Green(status)
	case "pending":
		return output.Yellow(status)
	case "failed":
		return output.Red(status)
	default:
		return output.Dim(status)
	}
}
