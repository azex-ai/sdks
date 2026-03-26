package output

import (
	"os"

	"github.com/fatih/color"
)

var noColor bool

// SetNoColor disables all terminal colors.
func SetNoColor(v bool) {
	noColor = v
	color.NoColor = v
}

// IsColorEnabled returns true when colors are active.
func IsColorEnabled() bool {
	return !noColor && !color.NoColor
}

func init() {
	// Disable color when not a TTY or when NO_COLOR env is set.
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		color.NoColor = true
	}
}

// Pre-built color functions used across the CLI.
var (
	Green   = color.New(color.FgGreen).SprintFunc()
	Red     = color.New(color.FgRed).SprintFunc()
	Yellow  = color.New(color.FgYellow).SprintFunc()
	Cyan    = color.New(color.FgCyan).SprintFunc()
	Bold    = color.New(color.Bold).SprintFunc()
	Dim     = color.New(color.Faint).SprintFunc()
	Magenta = color.New(color.FgMagenta).SprintFunc()
	Blue    = color.New(color.FgBlue).SprintFunc()

	GreenBold = color.New(color.FgGreen, color.Bold).SprintFunc()
	RedBold   = color.New(color.FgRed, color.Bold).SprintFunc()
	CyanBold  = color.New(color.FgCyan, color.Bold).SprintFunc()
)
