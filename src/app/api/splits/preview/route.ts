import { requireKycUser } from "@/server/auth";
import { route, json } from "@/server/http";
import { previewManualSplit } from "@/server/money-service";

export const GET = route(async () => json(await previewManualSplit((await requireKycUser()).id)));
