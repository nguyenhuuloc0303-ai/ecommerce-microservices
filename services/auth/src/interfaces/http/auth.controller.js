const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const prisma = require("../../infrastructure/database/prisma.client");
const config = require("../../infrastructure/config");
const { registerSchema, loginSchema } = require("./validators/auth.validator");

class AuthController {
  async register(req, res, next) {
    try {
      const validated = registerSchema.parse(req.body);
      const normalizedUsername = validated.username.toLowerCase();

      // Check unique username
      const existingUser = await prisma.user.findUnique({
        where: { username: normalizedUsername }
      });
      if (existingUser) {
        return res.status(409).json({ code: "CONFLICT", message: "Username already exists" });
      }

      // Check unique email if provided
      if (validated.email) {
        const existingEmail = await prisma.user.findUnique({
          where: { email: validated.email }
        });
        if (existingEmail) {
          return res.status(409).json({ code: "CONFLICT", message: "Email already exists" });
        }
      }

      // Hash password with bcrypt ($2...)
      const hashedPassword = await bcrypt.hash(validated.password, 10);

      // Transaction: create User + OutboxEvent
      const eventId = randomUUID();
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: normalizedUsername,
            password: hashedPassword,
            email: validated.email || null,
            phone: validated.phone || null,
            roleid: 1 // default: normal (CUSTOMER)
          }
        });

        const eventPayload = {
          eventId,
          eventType: "UserRegistered",
          version: 1,
          occurredAt: new Date().toISOString(),
          data: {
            uid: user.uid,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: "normal"
          }
        };

        await tx.outboxEvent.create({
          data: {
            id: eventId,
            eventType: "UserRegistered",
            topic: "user-registered",
            payload: eventPayload,
            status: "PENDING"
          }
        });

        return user;
      });

      return res.status(201).json({
        message: "User registered successfully",
        uid: result.uid
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const validated = loginSchema.parse(req.body);
      const normalizedUsername = validated.username.toLowerCase();

      const user = await prisma.user.findUnique({
        where: { username: normalizedUsername },
        include: { role: true }
      });

      // Generic 401 on invalid username or password (A6 / TC-IAM-03)
      if (!user) {
        return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid username or password" });
      }

      const isPasswordValid = await bcrypt.compare(validated.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid username or password" });
      }

      // Issue JWT { sub: uid, role: rolename } 3600s
      const token = jwt.sign(
        { sub: user.uid, role: user.role.rolename },
        config.JWT_SECRET,
        { expiresIn: 3600 }
      );

      return res.status(200).json({
        accessToken: token,
        tokenType: "Bearer",
        expiresIn: 3600
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
