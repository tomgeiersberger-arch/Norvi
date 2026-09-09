import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Markdown from "react-native-markdown-display";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/use-colors";
import { Fonts, type ThemeColors } from "@/constants/theme";
import { API_BASE_URL } from "@/lib/api-base";
import { orpc } from "@/lib/api";
import { useModel } from "@/queries/model";
import { useCapabilities } from "@/queries/capabilities";
import { imageUrl, transcribeAudio, uploadImage, type UploadedImage } from "@/lib/media";
import {
  useChatMessages,
  useChats,
  useCreateChat,
  useDeleteChat,
  useDeviceId,
  useRenameChat,
} from "@/queries/chats";


const SUGGESTIONS = [
  "Erklär mir Vektordatenbanken in 5 Sätzen",
  "Schreib eine Python-Funktion für Fibonacci",
  "5 Namen für eine Espresso-Bar in Wien",
];

interface StoredMessage {
  id: string;
  role: string;
  content: string;
  attachments?: string | null;
}

function textOf(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");
}

/** Attached images travel as `file` parts on the UI message. */
function imagesOf(message: UIMessage): UploadedImage[] {
  return message.parts
    .filter(
      (part) =>
        part.type === "file" &&
        typeof (part as { url?: unknown }).url === "string" &&
        String((part as { mediaType?: unknown }).mediaType ?? "").startsWith("image/"),
    )
    .map((part) => ({
      url: (part as { url: string }).url,
      mediaType: (part as { mediaType: string }).mediaType,
    }));
}

/** Stored attachments are a JSON string — malformed data must never break the chat. */
function parseAttachments(raw: string | null | undefined): UploadedImage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is UploadedImage =>
        typeof (item as { url?: unknown })?.url === "string" &&
        typeof (item as { mediaType?: unknown })?.mediaType === "string",
    );
  } catch {
    return [];
  }
}

function toUIMessages(rows: StoredMessage[] | undefined): UIMessage[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: [
      ...parseAttachments(row.attachments).map((image) => ({
        type: "file" as const,
        url: image.url,
        mediaType: image.mediaType,
      })),
      { type: "text" as const, text: row.content },
    ],
  })) as UIMessage[];
}

function markdownStyles(colors: ThemeColors) {
  return {
    body: { color: colors.foreground, fontSize: 15, lineHeight: 24, fontFamily: Fonts?.sans },
    paragraph: { marginTop: 0, marginBottom: 10 },
    heading1: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: "600" as const,
      marginBottom: 8,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 17,
      fontWeight: "600" as const,
      marginBottom: 6,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: "600" as const,
      marginBottom: 6,
    },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    link: { color: colors.primary },
    blockquote: {
      backgroundColor: colors.secondary,
      borderLeftColor: colors.primary,
      borderLeftWidth: 2,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 10,
    },
    hr: { backgroundColor: colors.border, height: 1 },
    code_inline: {
      color: colors.primary,
      backgroundColor: colors.secondary,
      fontFamily: Fonts?.mono,
      fontSize: 13,
    },
    fence: {
      backgroundColor: colors.code,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      color: colors.foreground,
      fontFamily: Fonts?.mono,
      fontSize: 12.5,
      padding: 12,
      marginBottom: 10,
    },
    code_block: {
      backgroundColor: colors.code,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      color: colors.foreground,
      fontFamily: Fonts?.mono,
      fontSize: 12.5,
      padding: 12,
      marginBottom: 10,
    },
    table: { borderColor: colors.border, borderRadius: 8, marginBottom: 10 },
    th: { padding: 6 },
    td: { padding: 6, borderColor: colors.border },
  };
}

/** NORVI logo mark. */
function Mark({ size = 30, colors }: { size?: number; colors: ThemeColors }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${colors.primary}26`,
        borderWidth: 1,
        borderColor: `${colors.primary}4D`,
      }}
    >
      <Ionicons name="sparkles" size={size * 0.5} color={colors.primary} />
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const model = useModel();
  const device = useDeviceId();
  const deviceId = device.data;

  const [sessionKey, setSessionKey] = useState("new-initial");
  const [chatId, setChatId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const chats = useChats(deviceId);
  const stored = useChatMessages(deviceId, chatId);

  const agentName = model.data?.agent ?? "NORVI";
  const modelLabel = model.isLoading ? "verbinde…" : (model.data?.label ?? "NORVI AI");

  const openChat = (id: string) => {
    setChatId(id);
    setSessionKey(id);
    setActiveId(id);
    setDrawer(false);
  };

  const newChat = () => {
    setChatId(null);
    setSessionKey(`new-${Date.now()}`);
    setActiveId(null);
    setDrawer(false);
  };

  const loadingHistory = Boolean(chatId) && stored.isLoading;

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.brand}>
          <Pressable
            onPress={() => setDrawer(true)}
            accessibilityLabel="Chat-Verlauf öffnen"
            style={styles.iconButton}
          >
            <Ionicons name="menu" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Mark colors={colors} />
          <View>
            <Text style={[styles.brandTitle, { color: colors.foreground }]}>{agentName}</Text>
            <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>{modelLabel}</Text>
          </View>
        </View>
        <Pressable
          onPress={newChat}
          accessibilityLabel="Neuer Chat"
          style={[styles.newChat, { borderColor: colors.border }]}
        >
          <Ionicons name="add" size={14} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Neu</Text>
        </Pressable>
      </View>

      {loadingHistory ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ChatSession
          key={sessionKey}
          chatId={chatId}
          deviceId={deviceId}
          agentName={agentName}
          colors={colors}
          initialMessages={toUIMessages(stored.data)}
          onCreated={(id) => {
            setActiveId(id);
            setChatId(id);
          }}
        />
      )}

      <HistoryDrawer
        visible={drawer}
        onClose={() => setDrawer(false)}
        colors={colors}
        loading={chats.isLoading}
        chats={(chats.data ?? []).map((chat) => ({ id: chat.id, title: chat.title }))}
        activeId={activeId}
        onSelect={openChat}
        onNewChat={newChat}
        deviceId={deviceId}
        onDeleted={(id) => {
          if (id === activeId) newChat();
        }}
      />
    </SafeAreaView>
  );
}

interface ChatSessionProps {
  chatId: string | null;
  deviceId: string | undefined;
  agentName: string;
  colors: ThemeColors;
  initialMessages: UIMessage[];
  onCreated: (id: string) => void;
}

function ChatSession({
  chatId,
  deviceId,
  agentName,
  colors,
  initialMessages,
  onCreated,
}: ChatSessionProps) {
  const queryClient = useQueryClient();
  const createChat = useCreateChat();
  const [input, setInput] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const capabilities = useCapabilities();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const listRef = useRef<FlatList<UIMessage>>(null);
  const idRef = useRef<string | null>(chatId);

  const { messages, sendMessage, stop, regenerate, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `${API_BASE_URL}/api/agent/messages` }),
  });

  const busy = status === "submitted" || status === "streaming";
  const waiting = status === "submitted" || (messages.at(-1)?.role === "user" && busy);

  useEffect(() => {
    if (status !== "ready" || !idRef.current) return;
    void queryClient.invalidateQueries({ queryKey: orpc.chats.key() });
  }, [status, queryClient]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0) || busy || !deviceId || uploading) return;
    setInput("");
    const attached = images;
    setImages([]);

    let target = idRef.current;
    if (!target) {
      const chat = await createChat.mutateAsync({ deviceId });
      target = chat.id;
      idRef.current = chat.id;
      onCreated(chat.id);
    }

    if (attached.length === 0) {
      await sendMessage({ text: trimmed }, { body: { chatId: target, deviceId } });
      return;
    }

    await sendMessage(
      {
        role: "user",
        parts: [
          ...attached.map((image) => ({
            type: "file" as const,
            url: image.url,
            mediaType: image.mediaType,
          })),
          { type: "text" as const, text: trimmed },
        ],
      },
      { body: { chatId: target, deviceId } },
    );
  };

  /** Uploads one picked/captured photo and keeps it as a pending attachment. */
  const attach = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!deviceId) return;
    setUploading(true);
    try {
      const uploaded = await uploadImage(asset.uri, deviceId, asset.mimeType, asset.fileName);
      setImages((current) => [...current, uploaded]);
    } catch (uploadError) {
      Alert.alert(
        "Bild konnte nicht gesendet werden",
        uploadError instanceof Error ? uploadError.message : "Unbekannter Fehler.",
      );
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Zugriff auf Fotos nötig",
        "Bitte den Zugriff auf die Fotos in den Einstellungen erlauben, um ein Bild zu senden.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) await attach(result.assets[0]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Kamerazugriff nötig",
        "Bitte den Kamerazugriff in den Einstellungen erlauben, um ein Foto aufzunehmen.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) await attach(result.assets[0]);
  };

  const chooseImageSource = () => {
    Alert.alert("Bild hinzufügen", "Woher soll das Bild kommen?", [
      { text: "Kamera", onPress: () => void takePhoto() },
      { text: "Galerie", onPress: () => void pickFromLibrary() },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  /** Start / stop the recording — the same button does both. */
  const toggleRecording = async () => {
    if (!deviceId) return;

    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error("Die Aufnahme ist leer geblieben.");
        const text = await transcribeAudio(uri, deviceId, "de");
        // Recognised text lands in the input field first so it can be edited.
        setInput((current) => (current ? `${current.trimEnd()} ${text}` : text));
      } catch (sttError) {
        Alert.alert(
          "Spracheingabe fehlgeschlagen",
          sttError instanceof Error ? sttError.message : "Unbekannter Fehler.",
        );
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Mikrofonzugriff nötig",
          "Bitte den Zugriff auf das Mikrofon in den Einstellungen erlauben, um Sprache aufzunehmen.",
        );
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (micError) {
      Alert.alert(
        "Aufnahme nicht möglich",
        micError instanceof Error ? micError.message : "Unbekannter Fehler.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Mark size={52} colors={colors} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Womit fangen wir an?
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {agentName} antwortet live, Token für Token — Code inklusive Formatierung.
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => void send(suggestion)}
                style={[
                  styles.suggestion,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={{ color: colors.foreground, fontSize: 13.5 }}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const text = textOf(item);
            if (item.role === "user") {
              const attached = imagesOf(item);
              return (
                <View style={styles.userRow}>
                  {attached.map((image) => (
                    <Image
                      key={image.url}
                      source={{ uri: imageUrl(image.url) }}
                      style={styles.messageImage}
                      resizeMode="cover"
                      accessibilityLabel="Angehängtes Bild"
                    />
                  ))}
                  {text.length > 0 && (
                    <View style={[styles.userBubble, { backgroundColor: colors.bubble }]}>
                      <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
                        {text}
                      </Text>
                    </View>
                  )}
                </View>
              );
            }
            return (
              <View style={styles.assistantRow}>
                <Mark size={28} colors={colors} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agentLabel, { color: colors.mutedForeground }]}>
                    {agentName}
                  </Text>
                  <Markdown style={markdownStyles(colors)}>{text}</Markdown>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <>
              {waiting && (
                <View style={styles.assistantRow}>
                  <Mark size={28} colors={colors} />
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
              {error && (
                <View style={{ paddingTop: 10, gap: 8 }}>
                  <Text style={{ color: colors.destructive, fontSize: 13 }}>{error.message}</Text>
                  <Pressable
                    onPress={() =>
                      void regenerate({ body: { chatId: idRef.current, deviceId } })
                    }
                    style={[styles.retry, { borderColor: colors.destructive }]}
                  >
                    <Ionicons name="refresh" size={13} color={colors.destructive} />
                    <Text style={{ color: colors.destructive, fontSize: 12 }}>
                      Nochmal versuchen
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          }
        />
      )}

      <View style={styles.composerWrap}>
        {images.length > 0 && (
          <View style={styles.thumbRow}>
            {images.map((image) => (
              <View key={image.url} style={styles.thumbWrap}>
                <Image source={{ uri: imageUrl(image.url) }} style={styles.thumb} />
                <Pressable
                  onPress={() => setImages((current) => current.filter((i) => i.url !== image.url))}
                  accessibilityLabel="Bild entfernen"
                  style={[styles.thumbRemove, { backgroundColor: colors.background }]}
                >
                  <Ionicons name="close" size={12} color={colors.foreground} />
                </Pressable>
              </View>
            ))}
            {uploading && <ActivityIndicator color={colors.primary} style={{ marginLeft: 4 }} />}
          </View>
        )}

        {(recording || transcribing) && (
          <View
            style={[
              styles.recordBar,
              { borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}1A` },
            ]}
          >
            {recording ? (
              <View style={[styles.recordDot, { backgroundColor: colors.primary }]} />
            ) : (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            <Text style={{ color: colors.primary, fontSize: 12.5 }}>
              {recording
                ? "Aufnahme läuft — Mikrofon erneut drücken zum Beenden"
                : "Aufnahme wird in Text umgewandelt …"}
            </Text>
          </View>
        )}

        <View
          style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {(capabilities.data?.vision ?? true) && (
            <Pressable
              onPress={chooseImageSource}
              disabled={busy || uploading}
              accessibilityLabel="Bild anhängen"
              style={styles.composerIcon}
            >
              <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}

          {(capabilities.data?.stt ?? false) && (
            <Pressable
              onPress={() => void toggleRecording()}
              disabled={busy || transcribing}
              accessibilityLabel={recording ? "Aufnahme beenden" : "Spracheingabe starten"}
              style={[
                styles.composerIcon,
                recording && { backgroundColor: `${colors.primary}26`, borderRadius: 999 },
              ]}
            >
              <Ionicons
                name={recording ? "stop" : "mic-outline"}
                size={20}
                color={recording ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          )}

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={recording ? "Sprich einfach …" : "Nachricht schreiben…"}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.input, { color: colors.foreground }]}
          />
          <Pressable
            onPress={() => (busy ? stop() : void send(input))}
            disabled={!busy && input.trim().length === 0 && images.length === 0}
            accessibilityLabel={busy ? "Antwort stoppen" : "Senden"}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  busy || (input.trim().length === 0 && images.length === 0)
                    ? colors.secondary
                    : colors.primary,
              },
            ]}
          >
            <Ionicons
              name={busy ? "square" : "arrow-up"}
              size={16}
              color={
                busy || (input.trim().length === 0 && images.length === 0)
                  ? colors.mutedForeground
                  : colors.primaryForeground
              }
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

interface HistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  loading: boolean;
  chats: { id: string; title: string }[];
  activeId: string | null;
  deviceId: string | undefined;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleted: (id: string) => void;
}

function HistoryDrawer({
  visible,
  onClose,
  colors,
  loading,
  chats,
  activeId,
  deviceId,
  onSelect,
  onNewChat,
  onDeleted,
}: HistoryDrawerProps) {
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const commit = () => {
    if (!editing || !deviceId) return setEditing(null);
    const title = editing.title.trim();
    if (title) renameChat.mutate({ deviceId, id: editing.id, title });
    setEditing(null);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.drawerRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
        <View
          style={[
            styles.drawer,
            { backgroundColor: colors.background, borderRightColor: colors.border },
          ]}
        >
          <SafeAreaView edges={["top", "bottom", "left"]} style={{ flex: 1 }}>
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Mark colors={colors} />
                <View>
                  <Text style={[styles.brandTitle, { color: colors.foreground }]}>NORVI</Text>
                  <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>NORVI AI</Text>
                </View>
              </View>
              <Pressable onPress={onClose} accessibilityLabel="Schließen" style={styles.iconButton}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Pressable
              onPress={onNewChat}
              style={[
                styles.drawerNew,
                { borderColor: colors.border, backgroundColor: colors.secondary },
              ]}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>
                Neuer Chat
              </Text>
            </Pressable>

            <Text style={[styles.drawerSection, { color: colors.mutedForeground }]}>VERLAUF</Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : chats.length === 0 ? (
              <Text style={[styles.drawerEmpty, { color: colors.mutedForeground }]}>
                Noch keine Chats. Deine Unterhaltungen erscheinen hier automatisch.
              </Text>
            ) : (
              <FlatList
                data={chats}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const active = item.id === activeId;
                  return (
                    <View
                      style={[
                        styles.drawerItem,
                        active && { backgroundColor: colors.secondary },
                      ]}
                    >
                      <Pressable
                        onPress={() => onSelect(item.id)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={14}
                          color={active ? colors.primary : colors.mutedForeground}
                        />
                        <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 13.5 }}>
                          {item.title}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditing({ id: item.id, title: item.title })}
                        accessibilityLabel="Chat umbenennen"
                        style={styles.iconButton}
                      >
                        <Ionicons name="pencil" size={14} color={colors.mutedForeground} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (!deviceId) return;
                          deleteChat.mutate(
                            { deviceId, id: item.id },
                            { onSuccess: () => onDeleted(item.id) },
                          );
                        }}
                        accessibilityLabel="Chat löschen"
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
          </SafeAreaView>
        </View>
      </View>

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={commit}>
        <View style={styles.renameRoot}>
          <View
            style={[styles.renameCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
              Chat umbenennen
            </Text>
            <TextInput
              value={editing?.title ?? ""}
              onChangeText={(title) => setEditing((prev) => (prev ? { ...prev, title } : prev))}
              style={[
                styles.renameInput,
                { color: colors.foreground, borderColor: colors.border },
              ]}
              onSubmitEditing={commit}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable onPress={() => setEditing(null)} style={styles.renameAction}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Abbrechen</Text>
              </Pressable>
              <Pressable
                onPress={commit}
                style={[styles.renameAction, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.primaryForeground, fontSize: 13, fontWeight: "600" }}>
                  Speichern
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  iconButton: { padding: 6, borderRadius: 10 },
  brandTitle: { fontSize: 15.5, fontWeight: "600" },
  brandSub: { fontSize: 11 },
  newChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 24 },
  userRow: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "88%",
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  agentLabel: { fontSize: 11, letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" },
  retry: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: "600", marginTop: 6 },
  emptyText: { fontSize: 13.5, textAlign: "center", maxWidth: 300, lineHeight: 20 },
  suggestions: { marginTop: 18, width: "100%", gap: 8 },
  suggestion: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  composerWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderWidth: 1,
    borderRadius: 24,
    padding: 8,
  },
  input: { flex: 1, maxHeight: 120, fontSize: 15, paddingHorizontal: 8, paddingVertical: 8 },
  composerIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  thumbWrap: { width: 64, height: 64, borderRadius: 14, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  thumbRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  },
  recordBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  recordDot: { width: 9, height: 9, borderRadius: 999 },
  messageImage: { width: 190, height: 190, borderRadius: 16, marginBottom: 6 },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerRoot: { flex: 1, flexDirection: "row" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  drawer: { width: "82%", maxWidth: 320, borderRightWidth: 1, height: "100%" },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  drawerNew: {
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  drawerSection: {
    fontSize: 10.5,
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  drawerEmpty: { fontSize: 12.5, lineHeight: 19, paddingHorizontal: 16, paddingTop: 8 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  renameRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 24,
  },
  renameCard: { width: "100%", borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
  },
  renameAction: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
