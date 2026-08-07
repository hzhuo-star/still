# Split authentication from editable Profiles

Keep Clerk as the owner of credentials, authenticated identity, and the projected identity image, while Still owns the Member's Handle, display name, and biography. Initialize those Still-owned fields through mandatory onboarding after authentication and stop later Clerk identity refreshes from overwriting them; this preserves the existing authentication integration while making Profile editing and Member search coherent without turning Still into an identity provider.
