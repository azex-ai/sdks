package cmd

import (
	"fmt"
	"os"

	"github.com/azex-ai/azex/cli/internal/config"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/azex-ai/azex/cli/internal/version"
	"github.com/spf13/cobra"
)

var (
	globalAPIKey  string
	globalBaseURL string
	globalJSON    bool
	globalNoColor bool

	// cfg is loaded once at PersistentPreRun and shared across commands.
	cfg *config.Config
)

var rootCmd = &cobra.Command{
	Use:   "azex",
	Short: "Azex CLI — manage your crypto-native LLM API",
	Long: `Azex CLI lets you manage API keys, check balances, chat with LLMs,
and monitor usage — all from the terminal.

Get started:
  azex auth login          # save your API key
  azex balance             # check your balance
  azex chat "Hello!"       # chat with the default model
  azex models list         # browse available models`,
	Version:           version.String(),
	SilenceUsage:      true,
	SilenceErrors:     true,
	PersistentPreRunE: loadConfig,
}

func loadConfig(cmd *cobra.Command, _ []string) error {
	// Skip for commands that don't need auth (auth login, config, version, completion)
	skip := map[string]bool{
		"login":      true,
		"logout":     true,
		"completion": true,
		"version":    true,
		"set":        true,
		"get":        true,
		"list":       true,
	}
	if skip[cmd.Name()] {
		var err error
		cfg, err = config.Load()
		if err != nil {
			cfg = &config.Config{}
		}
		applyGlobalFlags()
		return nil
	}

	var err error
	cfg, err = config.Load()
	if err != nil {
		cfg = &config.Config{}
	}
	applyGlobalFlags()
	return nil
}

func applyGlobalFlags() {
	if globalAPIKey != "" {
		cfg.APIKey = globalAPIKey
	}
	if globalBaseURL != "" {
		cfg.BaseURL = globalBaseURL
	}
	output.SetJSON(globalJSON)
	output.SetNoColor(globalNoColor)
}

// Execute runs the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		output.PrintError(err.Error())
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&globalAPIKey, "api-key", "", "Azex API key (overrides config and AZEX_API_KEY env var)")
	rootCmd.PersistentFlags().StringVar(&globalBaseURL, "base-url", "", "API base URL (default: https://api.azex.ai)")
	rootCmd.PersistentFlags().BoolVar(&globalJSON, "json", false, "Output as JSON (machine-readable)")
	rootCmd.PersistentFlags().BoolVar(&globalNoColor, "no-color", false, "Disable terminal colors")

	rootCmd.AddCommand(
		authCmd,
		chatCmd,
		modelsCmd,
		keysCmd,
		balanceCmd,
		transactionsCmd,
		usageCmd,
		depositCmd,
		logsCmd,
		apiCmd,
		configCmd,
	)

	// version subcommand
	rootCmd.AddCommand(&cobra.Command{
		Use:   "version",
		Short: "Show version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println("azex " + version.String())
		},
	})
}
