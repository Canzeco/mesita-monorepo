// Shared admin identity. There's exactly one Supabase Auth user that
// represents "admin" — its password IS the admin token. To grant
// access, share the password. To rotate, change the password in
// Supabase Studio (Authentication → Users → admin@mesita.ai → Reset
// password). To revoke, delete the user.
//
// The email is internal and never shown to the operator — the login
// form is a single password input. We sign in on the server with this
// email + the submitted password.
export const ADMIN_EMAIL = "admin@mesita.ai";
