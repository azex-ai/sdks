package cmd

import (
	"fmt"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var balanceCmd = &cobra.Command{
	Use:   "balance",
	Short: "Show your account balance",
	RunE:  runBalance,
}

type balanceResponse struct {
	Available string `json:"available"`
	Locked    string `json:"locked"`
	Pending   string `json:"pending"`
	Total     string `json:"total"`
	Currency  string `json:"currency"`
}

func runBalance(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp balanceResponse
	if err := c.Get(cmd.Context(), "/api/v1/billing/balance", &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	currency := resp.Currency
	if currency == "" {
		currency = "USD"
	}

	fmt.Printf("Available: %s | Locked: %s | Total: %s\n",
		output.GreenBold("$"+resp.Available),
		output.Yellow("$"+resp.Locked),
		output.Bold("$"+resp.Total),
	)

	if resp.Pending != "" && resp.Pending != "0.0000" && resp.Pending != "0.00" {
		fmt.Printf("Pending deposit: %s\n", output.Cyan("$"+resp.Pending))
	}

	return nil
}
