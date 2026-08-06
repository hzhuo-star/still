# Still

A finite, reading-first social product used to demonstrate disciplined AI-assisted development to the engineering team.

## Language

**Showcase**:
A deployed, reviewable product whose purpose is to demonstrate engineering judgment and a repeatable AI-assisted workflow within a one-day timebox.
_Avoid_: Demo, tutorial, full Twitter clone

**Member**:
A person with an authenticated identity who can publish and like posts.
_Avoid_: User, account, tweeter

**Post**:
A non-empty text message of at most 280 characters published by a member. Its author may delete it, but a published post cannot be edited.
_Avoid_: Tweet, status

**Feed**:
The public, reverse-chronological collection of posts from all members.
_Avoid_: Timeline, personalized feed

**Like**:
A member's reversible positive signal on a post; each member may like a post at most once.
_Avoid_: Favorite, reaction

**Profile**:
The public, read-only identity and collection of posts belonging to one member.
_Avoid_: Account page, user page
