package cmd

import (
	"fmt"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var keysCmd = &cobra.Command{
	Use:   "keys",
	Short: "Manage API keys",
}

var keysListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all API keys",
	RunE:  runKeysList,
}

var keysCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new API key",
	RunE:  runKeysCreate,
}

var keysRevokeCmd = &cobra.Command{
	Use:   "revoke <uid>",
	Short: "Permanently revoke an API key",
	Args:  cobra.ExactArgs(1),
	RunE:  runKeysRevoke,
}

var keysSuspendCmd = &cobra.Command{
	Use:   "suspend <uid>",
	Short: "Temporarily suspend an API key",
	Args:  cobra.ExactArgs(1),
	RunE:  runKeysSuspend,
}

var keysResumeCmd = &cobra.Command{
	Use:   "resume <uid>",
	Short: "Resume a suspended API key",
	Args:  cobra.ExactArgs(1),
	RunE:  runKeysResume,
}

var (
	keyName   string
	keyRPM    int
	keyModels []string
)

func init() {
	keysCreateCmd.Flags().StringVar(&keyName, "name", "", "Descriptive name for the key")
	keysCreateCmd.Flags().IntVar(&keyRPM, "rpm", 0, "Rate limit in requests per minute (0 = unlimited)")
	keysCreateCmd.Flags().StringSliceVar(&keyModels, "models", nil, "Comma-separated model whitelist (empty = all models)")

	keysCmd.AddCommand(keysListCmd, keysCreateCmd, keysRevokeCmd, keysSuspendCmd, keysResumeCmd)
}

type apiKey struct {
	UID       string   `json:"uid"`
	Name      string   `json:"name"`
	Prefix    string   `json:"prefix"`
	Status    string   `json:"status"`
	RPM       *int     `json:"rpm_limit"`
	Models    []string `json:"allowed_models"`
	CreatedAt string   `json:"created_at"`
	LastUsed  *string  `json:"last_used_at"`
}

type createKeyResponse struct {
	UID       string `json:"uid"`
	Name      string `json:"name"`
	Key       string `json:"key"` // full key shown only once
	CreatedAt string `json:"created_at"`
}

func runKeysList(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var keys []apiKey
	if err := c.Get(cmd.Context(), "/api/v1/keys", &keys); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(keys)
	}

	if len(keys) == 0 {
		fmt.Println("No API keys found. Create one with `azex keys create`.")
		return nil
	}

	t := output.NewTable("NAME", "PREFIX", "STATUS", "RPM", "CREATED")
	for _, k := range keys {
		status := colorStatus(k.Status)
		rpm := "unlimited"
		if k.RPM != nil && *k.RPM > 0 {
			rpm = fmt.Sprintf("%d", *k.RPM)
		}
		created := formatTime(k.CreatedAt)
		t.AddRow(k.Name, output.Dim(k.Prefix+"..."), status, rpm, created)
	}
	t.Flush()
	return nil
}

func runKeysCreate(cmd *cobra.Command, _ []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	body := map[string]any{}
	if keyName != "" {
		body["name"] = keyName
	}
	if keyRPM > 0 {
		body["rpm_limit"] = keyRPM
	}
	if len(keyModels) > 0 {
		body["allowed_models"] = keyModels
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp createKeyResponse
	if err := c.Post(cmd.Context(), "/api/v1/keys", body, &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	output.PrintSuccess("API key created")
	fmt.Printf("\n  %s\n\n", output.CyanBold(resp.Key))
	fmt.Println(output.Yellow("  Save this key — it won't be shown again!"))
	fmt.Printf("\n  Name: %s\n", resp.Name)
	fmt.Printf("  UID:  %s\n", output.Dim(resp.UID))
	return nil
}

func runKeysRevoke(cmd *cobra.Command, args []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	if err := c.Delete(cmd.Context(), "/api/v1/keys/"+args[0]); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(map[string]any{"uid": args[0], "status": "revoked"})
	}

	output.PrintSuccess(fmt.Sprintf("Key %s revoked", args[0]))
	return nil
}

func runKeysSuspend(cmd *cobra.Command, args []string) error {
	return patchKeyStatus(cmd, args[0], "suspended")
}

func runKeysResume(cmd *cobra.Command, args []string) error {
	return patchKeyStatus(cmd, args[0], "active")
}

func patchKeyStatus(cmd *cobra.Command, uid, status string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	var resp apiKey
	if err := c.Post(cmd.Context(), fmt.Sprintf("/api/v1/keys/%s/status", uid), map[string]string{"status": status}, &resp); err != nil {
		return formatAPIError(err)
	}

	if output.IsJSON() {
		return output.PrintJSON(resp)
	}

	output.PrintSuccess(fmt.Sprintf("Key %s status set to %s", uid, colorStatus(status)))
	return nil
}

func colorStatus(status string) string {
	switch strings.ToLower(status) {
	case "active":
		return output.Green(status)
	case "suspended":
		return output.Yellow(status)
	case "revoked":
		return output.Red(status)
	default:
		return output.Dim(status)
	}
}

func formatTime(t string) string {
	if len(t) >= 10 {
		return t[:10]
	}
	return t
}
