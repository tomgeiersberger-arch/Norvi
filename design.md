# NORVI AI — Design

Premium dark AI chat app on **web + mobile**. The product name in the UI is **NORVI**, the model label shown under it is **NORVI AI** — no provider or model names appear anywhere in the interface. Visual direction: near-black "studio dark", warm terracotta accent, generous vertical rhythm, sidebar with chat history, no chrome that isn't needed.

## Brand & Colors

Dark-first. Web/desktop tokens in `packages/web/src/web/styles.css`, mobile in `packages/mobile/constants/theme.ts` (`useColors()`).

| Token | Dark (primary) | Light | Use |
|-------|----------------|-------|-----|
| background | #0B0B0C | #FBFAF9 | App background |
| card | #16161A | #FFFFFF | Assistant surface, composer, sidebar |
| foreground | #F4F2EF | #17171A | Primary text |
| mutedForeground | #9A968F | #6F6B65 | Hints, labels, history meta |
| primary (accent) | #D97757 | #C25F3E | Send button, caret, focus ring, logo mark |
| border | rgba(255,255,255,0.08) | #E7E3DE | Hairlines |
| userBubble | #23232A | #EFEAE4 | User message bubble |
| destructive | #EF4444 | #DC2626 | Errors |

Accent is used sparingly: logo mark, send button, streaming caret, focus ring, inline code.

## Typography

- **Display + UI**: Poppins (300/400/500/600) on web; system font weight-matched on mobile.
- **Code**: JetBrains Mono, ~13px, code blocks and inline code.
- Message text ~0.97rem / line-height 1.75. Transcript max width 48rem, centered.

## Logo & Avatars

- `components/chat/norvi-mark.tsx` — `NORVIMark` (SVG starburst inside a terracotta tile, `pulse` while thinking) and `NORVIWordmark` ("NORVI" + "NORVI AI") used in the sidebar header.
- Assistant messages use `NORVIMark` as avatar; user messages a "DU" tile on the right.
- Mobile uses the same idea via an `Ionicons` sparkles mark in a terracotta tile.

## Layout

- **Web** (`pages/index.tsx`): fixed sidebar (17rem) on `md:` and up, off-canvas drawer with backdrop below that. Header: menu button (mobile) + mark + "NORVI" / "NORVI AI". Below: `ChatPane` with scrollable transcript and composer pinned to the bottom.
- **Sidebar** (`components/chat/sidebar.tsx`): wordmark, "Neuer Chat", "Verlauf" list with inline rename (Enter/Escape) and delete with inline confirm, skeletons while loading.
- **Mobile** (`packages/mobile/app/index.tsx`): header with menu button, transcript `FlatList`, `KeyboardAvoidingView` composer, history as a modal drawer with new/rename (own modal, no `Alert.prompt`)/delete.

Components (web): `chat-pane.tsx`, `sidebar.tsx`, `message.tsx`, `markdown.tsx`, `code-block.tsx`, `composer.tsx`, `empty-state.tsx`, `norvi-mark.tsx`.

## Motion

Restrained: staggered `rise` entrance on the empty state and drawer, blinking accent caret while streaming, three-dot typing indicator, hover/focus transitions on every button. Nothing else animates.

## Key User Flows

1. Open → empty state → type or tap a suggestion → Enter sends (Shift+Enter = newline).
2. First message creates a chat row; the title is auto-derived from that message and appears in the sidebar.
3. Answer streams in token by token; Stop button aborts, errors show a plain-language message with "Nochmal versuchen".
4. Reload → history is still there (device-scoped, no login); switch, rename or delete chats from the sidebar.

## Architecture

- **Agent**: `packages/web/src/api/agent/` — `ToolLoopAgent` via `createGateway` (`AI_GATEWAY_BASE_URL` / `AI_GATEWAY_API_KEY`). `AGENT_NAME = "NORVI"`, `MODEL_LABEL = "NORVI AI"`; `describeAgentError()` maps gateway failures to German messages.
- **Streaming route**: plain HTTP `POST /api/agent/messages` in `src/api/index.ts` — persists the user turn, auto-titles the chat, streams, stores the answer in `onFinish`.
- **Data**: Drizzle tables `chats` + `chat_messages`, scoped by `device_id`; oRPC procedures in `routes/chats.ts` (`list`, `create`, `rename`, `remove`, `messages`).
- **Clients**: `useChat` from `@ai-sdk/react` with `DefaultChatTransport`, `chatId`/`deviceId` sent per request. Device id: `localStorage` (web) / AsyncStorage (mobile), key `norvi.device-id`.

## Images & voice input

- **Upload**: `POST /api/upload` (multipart, session or device scoped, 12 MB, JPEG/PNG/WebP) stores the file under `UPLOAD_DIR` and returns `/api/files/<id>`. `GET /api/files/:id` serves it back — deliberately without a session check so `<img>` and React Native `<Image>` can load it; the 128-bit id is the protection.
- **To the model**: `withInlineImages()` in `src/api/index.ts` replaces every `/api/files/...` reference with an inline `data:` URL, so the real image bytes reach the model. A link would be useless — this server runs at home behind a router.
- **Gateway shim**: `unwrapFileParts()` in `agent/gateway.ts` rewrites `data: {type:"data",data:"<base64>"}` to a plain base64 string. The gateway's schema accepts string/Uint8Array/URL only; without this every image request fails with 400 "Invalid input".
- **Model routing**: `visionModelId()` — `AI_VISION_MODEL` wins, otherwise keep the current model when it is vision capable, else `anthropic/claude-sonnet-4.6`.
- **Storage**: `chat_messages.attachments` holds the short `/api/files/<id>` URLs as JSON, never base64.
- **Speech to text**: `POST /api/transcribe` forwards the audio to a self-hosted OpenAI-compatible Whisper server (`STT_BASE_URL`). No cloud fallback — without the variable `capabilities.stt` is false and the mic button stays hidden. Recognised text lands in the input field first and is editable before sending.
