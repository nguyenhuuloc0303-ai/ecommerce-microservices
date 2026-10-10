const { z } = require("zod");

const createProductSchema = z.object({
  pname: z.string({ required_error: "pname is required" }).min(1, "pname cannot be empty"),
  price: z.number({ required_error: "price is required" }).min(0, "price must be non-negative"),
  quantity: z.number({ required_error: "quantity is required" }).int("quantity must be an integer").min(0, "quantity must be non-negative")
});

const updateProductSchema = z.object({
  pname: z.string().min(1, "pname cannot be empty").optional(),
  price: z.number().min(0, "price must be non-negative").optional(),
  quantity: z.number().int("quantity must be an integer").min(0, "quantity must be non-negative").optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field (pname, price, quantity) must be provided"
});

module.exports = { createProductSchema, updateProductSchema };
