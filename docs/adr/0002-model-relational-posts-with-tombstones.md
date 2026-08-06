# Model relational posts explicitly and preserve tombstones

Store every post with a required kind and migrate existing posts to `standalone` rather than carrying a permanent legacy interpretation. Deleting a standalone post, reply, or quote post strips its author and content but preserves a tombstone record so stable links, conversations, and references remain coherent without race-prone inbound-reference checks; repost wrappers are hard-deleted because engagement always targets their source and nothing may independently reference them.
