import { Router } from "express";
import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { agreementsService } from "./agreements.service.js";

export const agreementsRouter = Router();
agreementsRouter.use(requireSession);
agreementsRouter.get("/", asyncHandler(async (req,res) => { res.json({ items: await agreementsService.list(req.session!.walletAddress) }); }));
agreementsRouter.post("/", asyncHandler(async (req,res) => { res.status(201).json({ version: await agreementsService.create(req.session!.walletAddress,req.body) }); }));
agreementsRouter.get("/:id", asyncHandler(async (req,res) => { res.json(await agreementsService.get(String(req.params.id),req.session!.walletAddress)); }));
agreementsRouter.put("/:id/draft", asyncHandler(async (req,res) => { res.json({ version: await agreementsService.edit(String(req.params.id),req.session!.walletAddress,req.body) }); }));
agreementsRouter.post("/:id/submit", asyncHandler(async (req,res) => { res.json({ version: await agreementsService.submit(String(req.params.id),req.session!.walletAddress) }); }));
agreementsRouter.post("/:id/cancel", asyncHandler(async (req,res) => { res.json({ version: await agreementsService.cancel(String(req.params.id),req.session!.walletAddress) }); }));
agreementsRouter.post("/:id/revisions", asyncHandler(async (req,res) => { res.status(201).json({ version: await agreementsService.revise(String(req.params.id),req.session!.walletAddress,req.body) }); }));
agreementsRouter.post("/:id/challenges", asyncHandler(async (req,res) => { res.status(201).json(await agreementsService.challenge(String(req.params.id),req.session!.walletAddress,req.body)); }));
agreementsRouter.post("/:id/responses", asyncHandler(async (req,res) => { res.json({ version: await agreementsService.respond(String(req.params.id),req.session!.walletAddress,req.body) }); }));
