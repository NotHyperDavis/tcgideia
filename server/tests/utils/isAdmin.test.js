const isAdmin = require("../../utils/isAdmin");

describe("isAdmin", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.ADMIN_EMAILS;
        delete process.env.ADMIN_EMAIL;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test("returns true when the user's email matches ADMIN_EMAIL", () => {
        process.env.ADMIN_EMAIL = "admin@example.com";
        expect(isAdmin({ email: "admin@example.com" })).toBe(true);
    });

    test("is case-insensitive", () => {
        process.env.ADMIN_EMAIL = "Admin@Example.com";
        expect(isAdmin({ email: "admin@example.com" })).toBe(true);
    });

    test("supports multiple admins via ADMIN_EMAILS", () => {
        process.env.ADMIN_EMAILS = "a@example.com, b@example.com";
        expect(isAdmin({ email: "b@example.com" })).toBe(true);
        expect(isAdmin({ email: "c@example.com" })).toBe(false);
    });

    test("returns false when no admin env vars are set", () => {
        expect(isAdmin({ email: "anyone@example.com" })).toBe(false);
    });
});
