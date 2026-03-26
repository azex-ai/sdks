package cmd

import (
	"fmt"
	"sort"

	"github.com/azex-ai/azex/cli/internal/config"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long: `Set a configuration value in ~/.config/azex/config.json.

Valid keys:
  api_key        — Your Azex API key
  base_url       — API base URL (default: https://api.azex.ai)
  default_model  — Default model for azex chat`,
	Args: cobra.ExactArgs(2),
	RunE: runConfigSet,
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value",
	Args:  cobra.ExactArgs(1),
	RunE:  runConfigGet,
}

var configListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List all configuration values",
	RunE:    runConfigList,
}

func init() {
	configCmd.AddCommand(configSetCmd, configGetCmd, configListCmd)
}

func runConfigSet(_ *cobra.Command, args []string) error {
	existing, err := config.Load()
	if err != nil {
		existing = &config.Config{}
	}

	if err := existing.Set(args[0], args[1]); err != nil {
		return err
	}

	if err := config.Save(existing); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	if output.IsJSON() {
		return output.PrintJSON(map[string]string{"key": args[0], "value": args[1]})
	}

	output.PrintSuccess(fmt.Sprintf("Set %s = %s", output.Bold(args[0]), output.Cyan(args[1])))
	return nil
}

func runConfigGet(_ *cobra.Command, args []string) error {
	existing, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	val, ok := existing.Get(args[0])
	if !ok {
		return fmt.Errorf("config key %q not set", args[0])
	}

	if output.IsJSON() {
		return output.PrintJSON(map[string]string{"key": args[0], "value": val})
	}

	fmt.Println(val)
	return nil
}

func runConfigList(_ *cobra.Command, _ []string) error {
	existing, err := config.Load()
	if err != nil {
		existing = &config.Config{}
	}

	all := existing.All()

	if output.IsJSON() {
		return output.PrintJSON(all)
	}

	if len(all) == 0 {
		fmt.Printf("No configuration set. Config file: %s\n", output.Dim(config.Path()))
		return nil
	}

	keys := make([]string, 0, len(all))
	for k := range all {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	fmt.Printf("%s\n\n", output.Dim(config.Path()))
	for _, k := range keys {
		v := all[k]
		if k == "api_key" && len(v) > 8 {
			v = maskKey(v)
		}
		fmt.Printf("  %-20s %s\n", output.Bold(k), output.Cyan(v))
	}
	return nil
}
