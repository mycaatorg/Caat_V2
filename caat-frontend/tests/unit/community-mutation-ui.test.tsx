// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePostForm } from "@/components/communities/CreatePostForm";
import { PostCard } from "@/components/communities/PostCard";
import { CommentsSection } from "@/components/communities/CommentsSection";
import type { CommunityComment, CommunityPost } from "@/types/community";

const actions = vi.hoisted(() => ({
  createPost: vi.fn(), fetchResumes: vi.fn(), searchSchools: vi.fn(),
  updatePost: vi.fn(), deletePost: vi.fn(), toggleLike: vi.fn(), toggleSave: vi.fn(),
  reportPost: vi.fn(), castPollVote: vi.fn(), blockUser: vi.fn(), pinPost: vi.fn(),
  fetchComments: vi.fn(), addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn(), toggleCommentLike: vi.fn(),
  errorToast: vi.fn(), successToast: vi.fn(), plainToast: vi.fn(),
}));

vi.mock("@/app/(main)/communities/actions", () => ({
  createPostAction: actions.createPost, fetchUserResumesAction: actions.fetchResumes, searchSchoolsAction: actions.searchSchools,
  updatePostAction: actions.updatePost, deletePostAction: actions.deletePost, toggleLikeAction: actions.toggleLike,
  toggleSaveAction: actions.toggleSave, reportPostAction: actions.reportPost, castPollVoteAction: actions.castPollVote,
  blockUserAction: actions.blockUser, pinPostAction: actions.pinPost, fetchCommentsAction: actions.fetchComments,
  addCommentAction: actions.addComment, updateCommentAction: actions.updateComment, deleteCommentAction: actions.deleteComment,
  toggleCommentLikeAction: actions.toggleCommentLike,
}));
vi.mock("sonner", () => ({ toast: { error: actions.errorToast, success: actions.successToast, toast: actions.plainToast } }));
vi.mock("next/dynamic", () => ({
  default: () => function RichEditorMock({ content, onChange }: { content: string; onChange: (value: string) => void }) {
    return <textarea aria-label="Rich text content" value={content} onChange={(event) => onChange(event.target.value)} />;
  },
}));

const author = { id: "user-1", first_name: "Ada", last_name: "Lovelace", avatar_url: null };
const post: CommunityPost = {
  id: "post-1", user_id: author.id, content: "<p>A useful post</p>", topic_tag: "ADVICE",
  university_id: null, school_name: null, major_id: null, result_card: null, score_card: null,
  group_id: null, resume_id: null, resume_title: null, is_anonymous: false, is_hidden: false,
  edited_at: null, poll_options: null, poll_votes: null, user_vote: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  likes_count: 0, comments_count: 0, saves_count: 0, author,
};

const roots: Root[] = [];

class ErrorBoundary extends React.Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? <p>Recovered from callback error</p> : this.props.children; }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function byText(text: string, selector = "*"): HTMLElement {
  const element = [...document.querySelectorAll<HTMLElement>(selector)].find((node) => node.textContent?.trim() === text);
  if (!element) throw new Error(`Element not found: ${text}`);
  return element;
}

function button(text: string): HTMLButtonElement {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.trim() === text);
  if (!element) throw new Error(`Button not found: ${text}`);
  return element;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function changeTextArea(element: HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function textArea(placeholderOrLabel: string): HTMLTextAreaElement {
  const element = placeholderOrLabel === ""
    ? document.querySelector<HTMLTextAreaElement>("textarea:not([placeholder]):not([aria-label])")
    : document.querySelector<HTMLTextAreaElement>(`textarea[placeholder="${placeholderOrLabel}"], textarea[aria-label="${placeholderOrLabel}"]`);
  if (!element) throw new Error(`Textarea not found: ${placeholderOrLabel}`);
  return element;
}

function buttonContaining(text: string): HTMLButtonElement {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.includes(text));
  if (!element) throw new Error(`Button containing not found: ${text}`);
  return element;
}

function lastButton(text: string): HTMLButtonElement {
  const matching = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((node) => node.textContent?.trim() === text);
  const element = matching.at(-1);
  if (!element) throw new Error(`Button not found: ${text}`);
  return element;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(assertion: () => void) {
  for (let i = 0; i < 20; i += 1) {
    try { assertion(); return; } catch { await flush(); }
  }
  assertion();
}

async function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
}

async function chooseAdvice() {
  await click(document.querySelector("button[role=combobox]")!);
  await flush();
  await click(byText("Advice", "[role=option]"));
  await flush();
}

const comment: CommunityComment = {
  id: "comment-1", post_id: post.id, user_id: author.id, parent_comment_id: null,
  content: "Original comment", created_at: new Date().toISOString(), likes_count: 0,
  is_liked_by_user: false, author, replies: [],
};

async function mountComments(comments: CommunityComment[] = []) {
  actions.fetchComments.mockResolvedValue({ comments });
  const onCountChange = vi.fn();
  await mount(<CommentsSection postId={post.id} currentUser={author} onCountChange={onCountChange} />);
  await flush();
  return onCountChange;
}

async function mountPost(onPostDeleted = vi.fn()) {
  await mount(<PostCard post={post} currentUser={author} initialIsLiked={false} initialIsSaved={false} onPostDeleted={onPostDeleted} />);
  return onPostDeleted;
}

async function openPostMenu() {
  const more = byText("More options", "span").closest("button");
  if (!more) throw new Error("Post menu trigger not found");
  await click(more);
  await flush();
}

describe("community mutation recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    actions.fetchResumes.mockResolvedValue([]);
    actions.searchSchools.mockResolvedValue([]);
    actions.createPost.mockResolvedValue({ post, error: null });
    actions.fetchComments.mockResolvedValue({ comments: [] });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
  });

  afterEach(() => {
    act(() => { for (const root of roots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
  });

  it("keeps a create-post draft after a rejected request and lets the author retry", async () => {
    const onPostCreated = vi.fn();
    actions.createPost.mockResolvedValueOnce({ post: null, error: "Post service is unavailable" });
    actions.createPost.mockRejectedValueOnce(new Error("Network request failed"));
    await mount(<CreatePostForm currentUser={author} onPostCreated={onPostCreated} />);

    await click(byText("Share your experience, results, or advice…"));
    const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Rich text content"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(editor, "My draft survives a network failure");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await chooseAdvice();
    await click(button("Post"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Post service is unavailable"));
    expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Rich text content"]')?.value).toBe("My draft survives a network failure");
    await click(button("Post"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not share your post. Please try again."));
    expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Rich text content"]')?.value).toBe("My draft survives a network failure");
    expect(onPostCreated).not.toHaveBeenCalled();
    expect(localStorage.getItem("caat:community-draft:feed")).toContain("My draft survives a network failure");

    await click(button("Post"));
    await waitFor(() => expect(onPostCreated).toHaveBeenCalledWith(post));
    expect(actions.successToast).toHaveBeenCalledWith("Post shared.");
    expect(localStorage.getItem("caat:community-draft:feed")).toBeNull();
  });

  it("keeps post edits open after a rejected update and saves them on retry", async () => {
    actions.updatePost.mockResolvedValueOnce({ error: "Post update was denied", content: null });
    actions.updatePost.mockRejectedValueOnce(new Error("Edit request failed"));
    await mountPost();
    await openPostMenu();
    await click(byText("Edit post", "[role=menuitem]"));
    await flush();
    const editor = textArea("Rich text content");
    await changeTextArea(editor, "<p>Edited post content</p>");
    await click(button("Save"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Post update was denied"));
    expect(textArea("Rich text content").value).toBe("<p>Edited post content</p>");
    await click(button("Save"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not update post. Please try again."));
    expect(textArea("Rich text content").value).toBe("<p>Edited post content</p>");
    expect(byText("Save")).toBeTruthy();

    actions.updatePost.mockResolvedValueOnce({ error: null, content: "<p>Edited post content</p>" });
    await click(button("Save"));
    await waitFor(() => expect(actions.successToast).toHaveBeenCalledWith("Post updated."));
    expect(byText("Edited post content", ".community-prose")).toBeTruthy();
  });

  it("does not remove a post when deletion rejects, and allows retry", async () => {
    const onPostDeleted = vi.fn();
    actions.deletePost.mockResolvedValueOnce({ error: "Post deletion was denied" });
    actions.deletePost.mockRejectedValueOnce(new Error("Delete request failed"));
    await mountPost(onPostDeleted);
    await openPostMenu();
    await click(byText("Delete post", "[role=menuitem]"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Post deletion was denied"));
    expect(byText("A useful post", ".community-prose")).toBeTruthy();
    await openPostMenu();
    await click(byText("Delete post", "[role=menuitem]"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not delete post. Please try again."));
    expect(byText("A useful post", ".community-prose")).toBeTruthy();
    expect(onPostDeleted).not.toHaveBeenCalled();

    actions.deletePost.mockResolvedValueOnce({ error: null });
    await openPostMenu();
    await click(byText("Delete post", "[role=menuitem]"));
    await waitFor(() => expect(onPostDeleted).toHaveBeenCalledWith(post.id));
    expect(actions.successToast).toHaveBeenCalledWith("Post deleted.");
  });

  it("retains a new comment after rejection and adds it on retry", async () => {
    actions.addComment.mockResolvedValueOnce({ comment: null, error: "Comment was denied" });
    actions.addComment.mockRejectedValueOnce(new Error("Comment request failed"));
    const onCountChange = await mountComments();
    const field = textArea("Write a comment… (⌘↵ to send)");
    await changeTextArea(field, "A comment draft");
    await click(buttonContaining("Post comment"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Comment was denied"));
    expect(textArea("Write a comment… (⌘↵ to send)").value).toBe("A comment draft");
    await click(buttonContaining("Post comment"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not post comment. Please try again."));
    expect(textArea("Write a comment… (⌘↵ to send)").value).toBe("A comment draft");
    expect(onCountChange).not.toHaveBeenCalled();

    const savedComment = { ...comment, id: "comment-2", content: "A comment draft" };
    actions.addComment.mockResolvedValueOnce({ comment: savedComment, error: null });
    await click(buttonContaining("Post comment"));
    await waitFor(() => expect(byText("A comment draft", "p")).toBeTruthy());
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it("retains a reply after rejection and appends it on retry", async () => {
    actions.addComment.mockResolvedValueOnce({ comment: null, error: "Reply was denied" });
    actions.addComment.mockRejectedValueOnce(new Error("Reply request failed"));
    await mountComments([comment]);
    await click(lastButton("Reply"));
    await changeTextArea(textArea("Write a reply…"), "A reply draft");
    await click(lastButton("Reply"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Reply was denied"));
    expect(textArea("Write a reply…").value).toBe("A reply draft");
    await click(lastButton("Reply"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not post reply. Please try again."));
    expect(textArea("Write a reply…").value).toBe("A reply draft");

    const savedReply = { ...comment, id: "reply-1", parent_comment_id: comment.id, content: "A reply draft" };
    actions.addComment.mockResolvedValueOnce({ comment: savedReply, error: null });
    await click(lastButton("Reply"));
    await waitFor(() => expect(byText("A reply draft", "p")).toBeTruthy());
  });

  it("keeps comment edit mode and content after rejection, then retries", async () => {
    actions.updateComment.mockResolvedValueOnce({ edited_at: null, error: "Comment edit was denied" });
    actions.updateComment.mockRejectedValueOnce(new Error("Edit comment request failed"));
    await mountComments([comment]);
    await click(button("Edit"));
    await changeTextArea(textArea(""), "Updated comment");
    await click(button("Save"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Comment edit was denied"));
    expect(textArea("").value).toBe("Updated comment");
    await click(button("Save"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not update comment. Please try again."));
    expect(textArea("").value).toBe("Updated comment");

    actions.updateComment.mockResolvedValueOnce({ edited_at: new Date().toISOString(), error: null });
    await click(button("Save"));
    await waitFor(() => expect(byText("Updated comment", "p")).toBeTruthy());
    expect(actions.updateComment).toHaveBeenCalledWith(comment.id, "Updated comment");
  });

  it("leaves a comment in place when deletion rejects and removes it on retry", async () => {
    actions.deleteComment.mockResolvedValueOnce({ mode: null, error: "Comment deletion was denied" });
    actions.deleteComment.mockRejectedValueOnce(new Error("Delete comment request failed"));
    const onCountChange = await mountComments([comment]);
    await click(button("Delete"));
    await click(button("Yes"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Comment deletion was denied"));
    expect(byText("Original comment", "p")).toBeTruthy();
    await click(button("Yes"));
    await waitFor(() => expect(actions.errorToast).toHaveBeenCalledWith("Could not delete comment. Please try again."));
    expect(byText("Original comment", "p")).toBeTruthy();
    expect(onCountChange).not.toHaveBeenCalled();

    actions.deleteComment.mockResolvedValueOnce({ mode: "hard", error: null });
    await click(button("Yes"));
    await waitFor(() => expect(document.querySelector("p")?.textContent).not.toContain("Original comment"));
    expect(onCountChange).toHaveBeenCalledWith(-1);
  });

  it("locks post edit controls while the update request is pending", async () => {
    const response = deferred<{ error: string | null; content: string }>();
    actions.updatePost.mockReturnValueOnce(response.promise);
    await mountPost();
    await openPostMenu();
    await click(byText("Edit post", "[role=menuitem]"));
    await flush();
    await changeTextArea(textArea("Rich text content"), "<p>Edited once</p>");
    await click(button("Save"));
    await flush();

    expect(button("Save").disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
    await click(button("Save"));
    expect(actions.updatePost).toHaveBeenCalledTimes(1);

    await act(async () => response.resolve({ error: null, content: "<p>Edited once</p>" }));
    await flush();
    expect(actions.successToast).toHaveBeenCalledWith("Post updated.");
  });

  it("locks post deletion while its request is pending", async () => {
    const response = deferred<{ error: string | null }>();
    actions.deletePost.mockReturnValueOnce(response.promise);
    const onPostDeleted = vi.fn();
    await mountPost(onPostDeleted);
    await openPostMenu();
    await click(byText("Delete post", "[role=menuitem]"));
    await flush();
    expect(actions.deletePost).toHaveBeenCalledTimes(1);

    await openPostMenu();
    const deleteItem = byText("Delete post", "[role=menuitem]");
    expect(deleteItem.getAttribute("aria-disabled")).toBe("true");
    await click(deleteItem);
    expect(actions.deletePost).toHaveBeenCalledTimes(1);

    await act(async () => response.resolve({ error: null }));
    await flush();
    expect(onPostDeleted).toHaveBeenCalledWith(post.id);
  });

  it("ignores repeated keyboard submission while adding a comment", async () => {
    const response = deferred<{ comment: CommunityComment; error: null }>();
    actions.addComment.mockReturnValueOnce(response.promise);
    await mountComments();
    const field = textArea("Write a comment… (⌘↵ to send)");
    await changeTextArea(field, "Keyboard comment");
    await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", ctrlKey: true })));
    await flush();
    await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", ctrlKey: true })));

    expect(actions.addComment).toHaveBeenCalledTimes(1);
    expect(buttonContaining("Post comment").disabled).toBe(true);
    expect(textArea("Write a comment… (⌘↵ to send)").value).toBe("Keyboard comment");
    await act(async () => response.resolve({ comment: { ...comment, id: "comment-kbd", content: "Keyboard comment" }, error: null }));
    await flush();
    expect(byText("Keyboard comment", "p")).toBeTruthy();
  });

  it("ignores repeated keyboard submission while replying", async () => {
    const response = deferred<{ comment: CommunityComment; error: null }>();
    actions.addComment.mockReturnValueOnce(response.promise);
    await mountComments([comment]);
    await click(button("Reply"));
    const field = textArea("Write a reply…");
    await changeTextArea(field, "Keyboard reply");
    await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", ctrlKey: true })));
    await flush();
    await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", ctrlKey: true })));

    expect(actions.addComment).toHaveBeenCalledTimes(1);
    expect(button("Posting…").disabled).toBe(true);
    expect(textArea("Write a reply…").value).toBe("Keyboard reply");
    await act(async () => response.resolve({ comment: { ...comment, id: "reply-kbd", parent_comment_id: comment.id, content: "Keyboard reply" }, error: null }));
    await flush();
    expect(byText("Keyboard reply", "p")).toBeTruthy();
  });

  it("ignores repeated keyboard submission while editing a comment", async () => {
    const response = deferred<{ edited_at: string; error: null }>();
    actions.updateComment.mockReturnValueOnce(response.promise);
    await mountComments([comment]);
    await click(button("Edit"));
    const field = textArea("");
    await changeTextArea(field, "Keyboard edit");
    await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", ctrlKey: true })));
    await flush();
    await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", ctrlKey: true })));

    expect(actions.updateComment).toHaveBeenCalledTimes(1);
    expect(button("Saving…").disabled).toBe(true);
    expect(textArea("").value).toBe("Keyboard edit");
    await act(async () => response.resolve({ edited_at: new Date().toISOString(), error: null }));
    await flush();
    expect(byText("Keyboard edit", "p")).toBeTruthy();
  });

  it("clears a create-post draft before notifying the parent of committed success", async () => {
    const caughtErrors: Error[] = [];
    const onPostCreated = vi.fn(() => {
      expect(localStorage.getItem("caat:community-draft:feed")).toBeNull();
      throw new Error("Feed callback failed");
    });
    await mount(<ErrorBoundary onError={(error) => caughtErrors.push(error)}><CreatePostForm currentUser={author} onPostCreated={onPostCreated} /></ErrorBoundary>);
    await click(byText("Share your experience, results, or advice…"));
    const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Rich text content"]')!;
    await changeTextArea(editor, "A committed draft");
    await chooseAdvice();
    await flush();
    await click(button("Post"));
    await waitFor(() => expect(onPostCreated).toHaveBeenCalledTimes(1));

    expect(actions.createPost).toHaveBeenCalledTimes(1);
    expect(onPostCreated).toHaveBeenCalledTimes(1);
    expect(caughtErrors).toHaveLength(1);
    expect(actions.errorToast).not.toHaveBeenCalled();
    expect(actions.successToast).toHaveBeenCalledWith("Post shared.");
    expect(localStorage.getItem("caat:community-draft:feed")).toBeNull();
  });

  it("clears an added comment before notifying the parent of committed success", async () => {
    const caughtErrors: Error[] = [];
    const onCountChange = vi.fn(() => {
      expect(textArea("Write a comment… (⌘↵ to send)").value).toBe("");
      throw new Error("Count callback failed");
    });
    actions.fetchComments.mockResolvedValue({ comments: [] });
    await mount(<ErrorBoundary onError={(error) => caughtErrors.push(error)}><CommentsSection postId={post.id} currentUser={author} onCountChange={onCountChange} /></ErrorBoundary>);
    await flush();
    await changeTextArea(textArea("Write a comment… (⌘↵ to send)"), "Committed comment");
    actions.addComment.mockResolvedValueOnce({ comment: { ...comment, content: "Committed comment" }, error: null });
    await click(buttonContaining("Post comment"));
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(1));

    expect(actions.addComment).toHaveBeenCalledTimes(1);
    expect(caughtErrors).toHaveLength(1);
    expect(actions.errorToast).not.toHaveBeenCalled();
  });
});
