package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/config"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage authentication",
}

var authLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Save your Azex API key",
	Long: `Store your API key in ~/.config/azex/config.json.
The key is validated against the API before saving.`,
	RunE: runAuthLogin,
}

var authLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove stored API key",
	RunE:  runAuthLogout,
}

var authStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show current authentication status",
	RunE:  runAuthStatus,
}

var loginAPIKey string

func init() {
	authLoginCmd.Flags().StringVar(&loginAPIKey, "api-key", "", "API key to store (skips interactive prompt)")
	authCmd.AddCommand(authLoginCmd, authLogoutCmd, authStatusCmd)
}

func runAuthLogin(cmd *cobra.Command, args []string) error {
	var key string

	if loginAPIKey != "" {
		key = loginAPIKey
	} else {
		// Try reading from stdin if it's not a TTY
		if !term.IsTerminal(int(os.Stdin.Fd())) {
			scanner := bufio.NewScanner(os.Stdin)
			if scanner.Scan() {
				key = strings.TrimSpace(scanner.Text())
			}
		}
	}

	if key == "" {
		fmt.Print("Enter your Azex API key: ")
		// Try to read silently (no echo)
		if term.IsTerminal(int(os.Stdin.Fd())) {
			b, err := term.ReadPassword(int(os.Stdin.Fd()))
			fmt.Println()
			if err != nil {
				return fmt.Errorf("read API key: %w", err)
			}
			key = strings.TrimSpace(string(b))
		} else {
			scanner := bufio.NewScanner(os.Stdin)
			if scanner.Scan() {
				key = strings.TrimSpace(scanner.Text())
			}
		}
	}

	if key == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	// Validate key by calling the balance endpoint
	fmt.Print("Validating API key... ")
	c := client.New(cfg.ResolvedBaseURL(), key)
	var balResp struct {
		Available string `json:"available"`
	}
	if err := c.Get(cmd.Context(), "/api/v1/billing/balance", &balResp); err != nil {
		fmt.Println(output.Red("✗"))
		return fmt.Errorf("invalid API key: %w", err)
	}
	fmt.Println(output.Green("✓"))

	// Save to config
	existing, _ := config.Load()
	if existing == nil {
		existing = &config.Config{}
	}
	existing.APIKey = key

	if err := config.Save(existing); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	output.PrintSuccess(fmt.Sprintf("API key saved to %s", config.Path()))
	return nil
}

func runAuthLogout(_ *cobra.Command, _ []string) error {
	existing, err := config.Load()
	if err != nil || existing.APIKey == "" {
		fmt.Println("Not logged in.")
		return nil
	}

	existing.APIKey = ""
	if err := config.Save(existing); err != nil {
		return fmt.Errorf("save config: %w", err)
	}
	output.PrintSuccess("Logged out — API key removed from config")
	return nil
}

func runAuthStatus(cmd *cobra.Command, _ []string) error {
	key := cfg.ResolvedAPIKey()
	source := "config file"
	if os.Getenv("AZEX_API_KEY") != "" {
		source = "environment variable AZEX_API_KEY"
	}

	if output.IsJSON() {
		if key == "" {
			return output.PrintJSON(map[string]any{"authenticated": false})
		}
		return output.PrintJSON(map[string]any{
			"authenticated": true,
			"key_prefix":    maskKey(key),
			"source":        source,
			"base_url":      cfg.ResolvedBaseURL(),
		})
	}

	if key == "" {
		fmt.Printf("%s Not authenticated\n", output.Red("✗"))
		fmt.Println(output.Dim("  Run `azex auth login` to set your API key"))
		return nil
	}

	// Validate against API
	c := client.New(cfg.ResolvedBaseURL(), key)
	var balResp struct {
		Available string `json:"available"`
	}
	apiOK := c.Get(cmd.Context(), "/api/v1/billing/balance", &balResp) == nil

	if apiOK {
		fmt.Printf("%s Authenticated\n", output.Green("✓"))
	} else {
		fmt.Printf("%s Key configured but API check failed\n", output.Yellow("!"))
	}
	fmt.Printf("  Key:      %s\n", output.Cyan(maskKey(key)))
	fmt.Printf("  Source:   %s\n", source)
	fmt.Printf("  Base URL: %s\n", cfg.ResolvedBaseURL())
	return nil
}

func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "..." + key[len(key)-4:]
}
