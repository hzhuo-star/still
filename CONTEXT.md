# Still

A finite, reading-first social product used to demonstrate disciplined AI-assisted development to the engineering team.

## Language

**Showcase**:
A deployed, reviewable product whose purpose is to demonstrate engineering judgment and a repeatable AI-assisted workflow within a one-day timebox.
_Avoid_: Demo, tutorial, full Twitter clone

**Member**:
A person with an authenticated identity who can publish and like posts and follow other members.
_Avoid_: User, account, tweeter

**Member Registration**:
The onboarding transition that initializes a member and their profile from an authenticated identity after they choose a unique handle and display name.
_Avoid_: User registration, account creation

**Handle**:
A unique, human-readable identifier through which a member can be found.
_Avoid_: Username, screen name

**Post**:
A publication created by a member. Every post is exactly one of a standalone post, reply, quote post, or repost; when it contains text, that text is at most 280 characters and may be edited while the post is active.
_Avoid_: Tweet, status

**Standalone Post**:
A post that contains the author's own content without addressing or republishing another post.
_Avoid_: Original tweet, top-level post

**Reply**:
A post with its own author, content, likes, and lifecycle that is addressed to exactly one parent post.
_Avoid_: Comment, response

**Quote Post**:
A post whose author adds commentary while republishing a referenced post.
_Avoid_: Quote tweet, quoted repost

**Repost**:
A member's republication of a referenced post without added commentary. It records the reposter and publication time but carries no engagement independent of the referenced post; a member may have at most one active repost of the same source and may remove it.
_Avoid_: Retweet, empty quote post

**Conversation**:
A standalone post or quote post together with every reply descended from it, presented as one flat discussion.
_Avoid_: Thread tree, comment tree

**Post Tombstone**:
A content-free, author-free placeholder that preserves a deleted post's position and relationships within a conversation. It appears only within that conversation and cannot receive engagement.
_Avoid_: Deleted-content snapshot, removed post

**Feed**:
The public, reverse-chronological collection of posts from all members.
_Avoid_: Timeline, personalized feed

**Following Feed**:
A member's reverse-chronological collection of posts selected through that member's follow relationships.
_Avoid_: Timeline, personalized feed, algorithmic feed

**Follow**:
A public, one-way relationship in which one member chooses to receive another member's eligible posts in their following feed.
_Avoid_: Friend, connection, subscription

**Like**:
A member's reversible positive signal on a post; each member may like a post at most once.
_Avoid_: Favorite, reaction

**Profile**:
The public handle, display name, biography, identity image, and collection of posts belonging to one member.
_Avoid_: Account page, user page
