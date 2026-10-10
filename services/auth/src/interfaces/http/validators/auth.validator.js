const { z } = require("zod");

const registerSchema = z.object({
  username: z.string({ required_error: "username is required" }).min(3, "username must have at least 3 characters").trim(),
  password: z.string({ required_error: "password is required" }).min(6, "password must have at least 6 characters"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional()
});

const loginSchema = z.object({
  username: z.string({ required_error: "username is required" }).min(1, "username cannot be empty"),
  password: z.string({ required_error: "password is required" }).min(1, "password cannot be empty")
});

module.exports = { registerSchema, loginSchema };
