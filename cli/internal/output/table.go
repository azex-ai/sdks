package output

import (
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"
)

// Table renders aligned columns to stdout.
type Table struct {
	w       *tabwriter.Writer
	headers []string
}

// NewTable creates a new Table writer targeting stdout.
func NewTable(headers ...string) *Table {
	t := &Table{
		w:       tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0),
		headers: headers,
	}
	if len(headers) > 0 {
		// Print header row in bold/dim
		styledHeaders := make([]string, len(headers))
		for i, h := range headers {
			styledHeaders[i] = Bold(strings.ToUpper(h))
		}
		fmt.Fprintln(t.w, strings.Join(styledHeaders, "\t"))
	}
	return t
}

// NewTableWriter creates a Table targeting an arbitrary writer.
func NewTableWriter(w io.Writer, headers ...string) *Table {
	t := &Table{
		w:       tabwriter.NewWriter(w, 0, 0, 2, ' ', 0),
		headers: headers,
	}
	if len(headers) > 0 {
		styledHeaders := make([]string, len(headers))
		for i, h := range headers {
			styledHeaders[i] = Bold(strings.ToUpper(h))
		}
		fmt.Fprintln(t.w, strings.Join(styledHeaders, "\t"))
	}
	return t
}

// AddRow appends a row of values.
func (t *Table) AddRow(cols ...string) {
	fmt.Fprintln(t.w, strings.Join(cols, "\t"))
}

// Flush writes buffered output.
func (t *Table) Flush() {
	t.w.Flush()
}
