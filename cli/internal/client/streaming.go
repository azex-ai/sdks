package client

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// SSEEvent represents a single server-sent event.
type SSEEvent struct {
	Data string
}

// StreamDelta is the content delta from an OpenAI-format SSE chunk.
type StreamDelta struct {
	Content string `json:"content"`
}

// StreamChoice is one choice in a streaming response chunk.
type StreamChoice struct {
	Delta        StreamDelta `json:"delta"`
	FinishReason *string     `json:"finish_reason"`
}

// StreamChunk is an OpenAI-compatible streaming chunk.
type StreamChunk struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
	Usage   *StreamUsage   `json:"usage"`
}

// StreamUsage carries token counts (present in final chunk when stream_options.include_usage is true).
type StreamUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// SSEReader reads server-sent events from an io.Reader.
type SSEReader struct {
	scanner *bufio.Scanner
}

// NewSSEReader wraps r in an SSEReader.
func NewSSEReader(r io.Reader) *SSEReader {
	return &SSEReader{scanner: bufio.NewScanner(r)}
}

// Next returns the next SSEEvent, or io.EOF when the stream ends.
func (r *SSEReader) Next() (*SSEEvent, error) {
	for r.scanner.Scan() {
		line := r.scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				return nil, io.EOF
			}
			return &SSEEvent{Data: data}, nil
		}
		// Skip empty lines and comment lines (": ...")
	}
	if err := r.scanner.Err(); err != nil {
		return nil, fmt.Errorf("SSE read error: %w", err)
	}
	return nil, io.EOF
}

// ParseChunk parses an SSE event data payload into a StreamChunk.
func ParseChunk(data string) (*StreamChunk, error) {
	var chunk StreamChunk
	if err := json.Unmarshal([]byte(data), &chunk); err != nil {
		return nil, fmt.Errorf("parse chunk: %w", err)
	}
	return &chunk, nil
}

// ContentDelta extracts the text delta from a streaming chunk (first choice).
func ContentDelta(chunk *StreamChunk) string {
	if len(chunk.Choices) == 0 {
		return ""
	}
	return chunk.Choices[0].Delta.Content
}
