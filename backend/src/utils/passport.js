import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL, // e.g. http://localhost:5000/api/auth/google/callback
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email     = profile.emails?.[0]?.value;
        const avatar    = profile.photos?.[0]?.value;
        const firstName = profile.name?.givenName  || "";
        const lastName  = profile.name?.familyName || "";

        if (!email) return done(new Error("No email from Google"), null);

        // ── Check if user already exists ──────────────────
        let user = await User.findOne({ email });

        if (user) {
          // Existing email/password user — link Google to their account
          if (!user.googleId) {
            user.googleId     = profile.id;
            user.authProvider = user.password ? "both" : "google";
            await user.save();
          }
          return done(null, user);
        }

        // ── New user — create from Google profile ─────────
        user = await User.create({
          fName:        firstName,
          lName:        lastName,
          email,
          avatar,
          googleId:     profile.id,
          authProvider: "google",
          // no password — Google users don't need one
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;