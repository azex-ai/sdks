package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/azex-ai/azex/cli/internal/client"
	"github.com/azex-ai/azex/cli/internal/output"
	"github.com/spf13/cobra"
)

var apiCmd = &cobra.Command{
	Use:   "api <path>",
	Short: "Make a raw API request",
	Long: `Execute a raw HTTP request against the Azex API, similar to gh api.

Examples:
  azex api /api/v1/billing/balance
  azex api -X POST /api/v1/keys -d '{"name":"test"}'
  azex api /api/v1/models --jq '.[0].uid'`,
	Args: cobra.ExactArgs(1),
	RunE: runAPI,
}

var (
	apiMethod  string
	apiData    string
	apiJQ      string
	apiHeaders []string
)

func init() {
	apiCmd.Flags().StringVarP(&apiMethod, "method", "X", "", "HTTP method (default: GET, or POST if -d is set)")
	apiCmd.Flags().StringVarP(&apiData, "data", "d", "", "Request body (JSON string or @file)")
	apiCmd.Flags().StringVar(&apiJQ, "jq", "", "jq-like filter (supports .[N], .field, .[].field)")
	apiCmd.Flags().StringArrayVarP(&apiHeaders, "header", "H", nil, "Extra headers (key:value)")
}

func runAPI(cmd *cobra.Command, args []string) error {
	key, err := client.ResolveAPIKey(cfg)
	if err != nil {
		return err
	}

	path := args[0]
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	method := apiMethod
	if method == "" {
		if apiData != "" {
			method = http.MethodPost
		} else {
			method = http.MethodGet
		}
	}
	method = strings.ToUpper(method)

	// Parse extra headers
	extraHeaders := make(map[string]string)
	for _, h := range apiHeaders {
		parts := strings.SplitN(h, ":", 2)
		if len(parts) == 2 {
			extraHeaders[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}

	// Prepare body
	var bodyReader io.Reader
	if apiData != "" {
		if strings.HasPrefix(apiData, "@") {
			// Read from file
			fname := strings.TrimPrefix(apiData, "@")
			f, err := os.Open(fname)
			if err != nil {
				return fmt.Errorf("open file %q: %w", fname, err)
			}
			defer f.Close()
			bodyReader = f
		} else {
			bodyReader = strings.NewReader(apiData)
		}
	}

	c := client.New(cfg.ResolvedBaseURL(), key)
	status, data, headers, err := c.RawRequest(cmd.Context(), method, path, bodyReader, extraHeaders)
	if err != nil {
		return err
	}

	// Print headers to stderr if verbose
	contentType := headers.Get("Content-Type")
	_ = contentType

	// Pretty-print JSON
	if apiJQ != "" {
		filtered, err := applyJQFilter(data, apiJQ)
		if err != nil {
			output.PrintWarning(fmt.Sprintf("filter error: %v", err))
			fmt.Println(string(data))
		} else {
			fmt.Println(filtered)
		}
		return nil
	}

	var pretty json.RawMessage
	if json.Unmarshal(data, &pretty) == nil {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(pretty)
	} else {
		fmt.Println(string(data))
	}

	if status >= 400 {
		return fmt.Errorf("API returned %d", status)
	}
	return nil
}

// applyJQFilter applies a simple jq-like filter to JSON data.
// Supports: .field, .[N], .[].field, .[] | .field
func applyJQFilter(data []byte, filter string) (string, error) {
	var v any
	if err := json.Unmarshal(data, &v); err != nil {
		return "", fmt.Errorf("parse JSON: %w", err)
	}

	result, err := evalFilter(v, filter)
	if err != nil {
		return "", err
	}

	switch r := result.(type) {
	case string:
		return fmt.Sprintf("%q", r), nil
	case []any:
		var lines []string
		for _, item := range r {
			b, _ := json.MarshalIndent(item, "", "  ")
			lines = append(lines, string(b))
		}
		return strings.Join(lines, "\n"), nil
	default:
		b, _ := json.MarshalIndent(result, "", "  ")
		return string(b), nil
	}
}

func evalFilter(v any, filter string) (any, error) {
	filter = strings.TrimSpace(filter)
	if filter == "" || filter == "." {
		return v, nil
	}

	// Strip leading dot
	if strings.HasPrefix(filter, ".") {
		filter = filter[1:]
	}

	// Handle .[] iteration
	if strings.HasPrefix(filter, "[]") {
		arr, ok := v.([]any)
		if !ok {
			return nil, fmt.Errorf("not an array")
		}
		rest := strings.TrimPrefix(filter, "[]")
		rest = strings.TrimPrefix(rest, ".")

		if rest == "" {
			return arr, nil
		}

		var results []any
		for _, item := range arr {
			r, err := evalFilter(item, "."+rest)
			if err != nil {
				continue
			}
			results = append(results, r)
		}
		return results, nil
	}

	// Handle array index .[N] — already stripped leading dot
	if strings.HasPrefix(filter, "[") {
		end := strings.Index(filter, "]")
		if end == -1 {
			return nil, fmt.Errorf("unclosed [")
		}
		indexStr := filter[1:end]
		rest := filter[end+1:]

		arr, ok := v.([]any)
		if !ok {
			return nil, fmt.Errorf("not an array")
		}

		var idx int
		fmt.Sscanf(indexStr, "%d", &idx)
		if idx < 0 || idx >= len(arr) {
			return nil, fmt.Errorf("index %d out of bounds", idx)
		}

		return evalFilter(arr[idx], rest)
	}

	// Handle .field or .field.rest
	obj, ok := v.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("not an object")
	}

	dot := strings.Index(filter, ".")
	bracket := strings.Index(filter, "[")

	var field, rest string
	if dot == -1 && bracket == -1 {
		field = filter
	} else if dot == -1 {
		field = filter[:bracket]
		rest = filter[bracket:]
	} else if bracket == -1 {
		field = filter[:dot]
		rest = filter[dot+1:]
	} else if dot < bracket {
		field = filter[:dot]
		rest = filter[dot+1:]
	} else {
		field = filter[:bracket]
		rest = filter[bracket:]
	}

	val, exists := obj[field]
	if !exists {
		return nil, fmt.Errorf("field %q not found", field)
	}

	if rest == "" {
		return val, nil
	}
	return evalFilter(val, "."+rest)
}
