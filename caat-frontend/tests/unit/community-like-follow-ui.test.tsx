// @vitest-environment jsdom
// PROD-102: in the feeds the card's props are never refreshed, so the buttons
// must keep a successful like, save or follow and undo only a failed one.
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostCard } from "@/components/communities/PostCard";
import { CommentItem } from "@/components/communities/CommentItem";
import { FollowButton } from "@/components/communities/FollowButton";
import type { CommunityComment, CommunityPost } from "@/types/community";
import { flush, mountComponent, unmountAll } from "./dom-helpers";

const actions = vi.hoisted(() => ({
  toggleLike: vi.fn(), toggleSave: vi.fn(), toggleCommentLike: vi.fn(), follow: vi.fn(), unfollow: vi.fn(),
  errorToast: vi.fn(), successToast: vi.fn(), plainToast: vi.fn(),
}));

vi.mock("@/app/(main)/communities/actions", () => ({
  toggleLikeAction: actions.toggleLike, toggleSaveAction: actions.toggleSave, toggleCommentLikeAction: actions.toggleCommentLike,
  followUserAction: actions.follow, unfollowUserAction: actions.unfollow,
  reportPostAction: vi.fn(), deletePostAction: vi.fn(), updatePostAction: vi.fn(), castPollVoteAction: vi.fn(),
  blockUserAction: vi.fn(), pinPostAction: vi.fn(), fetchCommentsAction: vi.fn(), addCommentAction: vi.fn(),
  updateCommentAction: vi.fn(), deleteCommentAction: vi.fn(),
}));
vi.mock("sonner", () => {
  const toast = Object.assign(actions.plainToast, { error: actions.errorToast, success: actions.successToast });
  return { toast };
});
vi.mock("next/dynamic", () => ({ default: () => function DynamicStub() { return null; } }));

const author = { id: "user-1", first_name: "Ada", last_name: "Lovelace", avatar_url: null };
const viewer = { id: "user-2", first_name: "Grace", last_name: "Hopper", avatar_url: null };
const post: CommunityPost = {
  id: "post-1", user_id: author.id, content: "<p>A useful post</p>", topic_tag: "ADVICE",
  university_id: null, school_name: null, major_id: null, result_card: null, score_card: null,
  group_id: null, resume_id: null, resume_title: null, is_anonymous: false, is_hidden: false,
  edited_at: null, poll_options: null, poll_votes: null, user_vote: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  likes_count: 2, comments_count: 0, saves_count: 0, author,
};
const comment = {
  id: "comment-1", post_id: post.id, user_id: author.id, parent_comment_id: null, content: "A comment",
  created_at: new Date().toISOString(), likes_count: 1, is_liked_by_user: false, author, replies: [],
} as unknown as CommunityComment;

const likeButton = () => document.querySelector<HTMLButtonElement>('button[aria-label$="likes"], button[aria-label$="like"]')!;
const saveButton = () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => /save post$/i.test(b.textContent ?? ""))!;
const commentLike = () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.querySelector("svg.lucide-heart"))!;
const followButton = () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => /follow/i.test(b.textContent ?? ""))!;

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
}

describe("community buttons keep what was saved", () => {
  beforeEach(() => Object.values(actions).forEach((mock) => mock.mockReset()));
  afterEach(() => unmountAll());

  it("keeps a successful post like and undoes a failed one", async () => {
    await mountComponent(<PostCard post={post} currentUser={viewer} initialIsLiked={false} initialIsSaved={false} />);
    actions.toggleLike.mockResolvedValueOnce({ liked: true, error: null });
    await click(likeButton());
    expect(likeButton().getAttribute("aria-pressed")).toBe("true");
    expect(likeButton().getAttribute("aria-label")).toBe("Unlike post, 3 likes");

    actions.toggleLike.mockResolvedValueOnce({ liked: true, error: "Could not update like." });
    await click(likeButton());
    expect(likeButton().getAttribute("aria-pressed")).toBe("true");
    expect(likeButton().getAttribute("aria-label")).toBe("Unlike post, 3 likes");
    expect(actions.errorToast).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful save and undoes a failed one", async () => {
    await mountComponent(<PostCard post={post} currentUser={viewer} initialIsLiked={false} initialIsSaved={false} />);
    actions.toggleSave.mockResolvedValueOnce({ saved: true, error: null });
    await click(saveButton());
    expect(saveButton().getAttribute("aria-pressed")).toBe("true");

    actions.toggleSave.mockResolvedValueOnce({ saved: true, error: "Could not save post." });
    await click(saveButton());
    expect(saveButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps a successful comment like and undoes a failed one", async () => {
    await mountComponent(<CommentItem comment={comment} currentUser={viewer} onReplyAdded={vi.fn()} onEdited={vi.fn()} onDeleted={vi.fn()} />);
    actions.toggleCommentLike.mockResolvedValueOnce({ liked: true, error: null });
    await click(commentLike());
    expect(commentLike().textContent).toBe("2");
    expect(commentLike().querySelector("svg")?.getAttribute("class")).toContain("fill-current");

    actions.toggleCommentLike.mockResolvedValueOnce({ liked: true, error: "Could not update like." });
    await click(commentLike());
    expect(commentLike().textContent).toBe("2");
  });

  it("keeps a successful follow and undoes a failed unfollow", async () => {
    await mountComponent(<FollowButton targetUserId={author.id} initialIsFollowing={false} />);
    actions.follow.mockResolvedValueOnce({ error: null });
    await click(followButton());
    expect(followButton().textContent).toMatch(/following/i);

    actions.unfollow.mockResolvedValueOnce({ error: "Could not unfollow this person." });
    await click(followButton());
    expect(followButton().textContent).toMatch(/following/i);
    expect(actions.errorToast).toHaveBeenCalledWith("Could not unfollow this person.");
  });
});
