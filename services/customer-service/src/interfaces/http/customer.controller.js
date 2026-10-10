const prisma = require("../../infrastructure/database/prisma.client");

class CustomerController {
  // API-CUS-01: GET /api/customers/:uid
  async getOne(req, res, next) {
    try {
      const targetUid = Number(req.params.uid);
      const callerId = Number(req.headers["x-user-id"]);
      const callerRole = (req.headers["x-user-role"] || "").toLowerCase();

      // Ownership check: normal can only see their own uid (A3 / TC-CUS-02)
      if (callerRole === "normal" && targetUid !== callerId) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden: you can only view your own profile" });
      }

      const customer = await prisma.customer.findUnique({
        where: { uid: targetUid },
        include: { membership: true }
      });

      if (!customer) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Customer with uid ${targetUid} not found` });
      }

      // Return format adhering to A7 and TC-CUS-04
      return res.status(200).json({
        uid: customer.uid,
        fullname: customer.fullname,
        mid: customer.mid,
        membership: {
          mname: customer.membership.mname,
          score: customer.membership.score
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // API-CUS-02: PUT /api/customers/:uid
  async update(req, res, next) {
    try {
      const targetUid = Number(req.params.uid);
      const callerId = Number(req.headers["x-user-id"]);
      const callerRole = (req.headers["x-user-role"] || "").toLowerCase();
      const { fullname, mid } = req.body;

      // Ownership check for normal user
      if (callerRole === "normal" && targetUid !== callerId) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden: you can only update your own profile" });
      }

      // Escalation of privilege check (A3 / TC-CUS-03): normal cannot send mid
      if (callerRole === "normal" && mid !== undefined) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden: only ADMIN can change membership tier (mid)" });
      }

      // Check customer exists
      const existing = await prisma.customer.findUnique({ where: { uid: targetUid } });
      if (!existing) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Customer with uid ${targetUid} not found` });
      }

      // If admin updates mid, verify mid exists
      if (mid !== undefined) {
        const validTier = await prisma.memberShip.findUnique({ where: { mid: Number(mid) } });
        if (!validTier) {
          return res.status(400).json({ code: "VALIDATION_ERROR", message: `Invalid mid: membership tier ${mid} does not exist` });
        }
      }

      const updateData = {};
      if (fullname !== undefined) updateData.fullname = fullname;
      if (mid !== undefined && callerRole === "admin") updateData.mid = Number(mid);

      const updated = await prisma.customer.update({
        where: { uid: targetUid },
        data: updateData,
        include: { membership: true }
      });

      return res.status(200).json({
        uid: updated.uid,
        fullname: updated.fullname,
        mid: updated.mid,
        membership: {
          mname: updated.membership.mname,
          score: updated.membership.score
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();
