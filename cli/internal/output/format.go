package output

import (
	"encoding/json"
	"fmt"
	"os"
)

var jsonMode bool

// SetJSON enables JSON output mode globally.
func SetJSON(v bool) {
	jsonMode = v
}

// IsJSON returns true when JSON output is active.
func IsJSON() bool {
	return jsonMode
}

// PrintJSON prints v as indented JSON to stdout.
func PrintJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// PrintError prints an error message to stderr in a consistent format.
func PrintError(msg string) {
	fmt.Fprintf(os.Stderr, "%s %s\n", RedBold("error:"), msg)
}

// PrintErrorf prints a formatted error message to stderr.
func PrintErrorf(format string, args ...any) {
	PrintError(fmt.Sprintf(format, args...))
}

// PrintSuccess prints a success message with a green check.
func PrintSuccess(msg string) {
	fmt.Printf("%s %s\n", GreenBold("✓"), msg)
}

// PrintWarning prints a warning message with a yellow indicator.
func PrintWarning(msg string) {
	fmt.Fprintf(os.Stderr, "%s %s\n", Yellow("warning:"), msg)
}

// PrintInfo prints an informational message dimmed.
func PrintInfo(msg string) {
	fmt.Println(Dim(msg))
}
