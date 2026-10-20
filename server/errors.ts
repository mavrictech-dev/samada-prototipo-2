export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function fail(message: string, status=400): never { throw new AppError(message,status); }
export function errorResponse(error: unknown) {
  if(error instanceof AppError)return Response.json({error:error.message},{status:error.status});
  if(error && typeof error === "object" && "code" in error) {
    if(error.code === "23505")return Response.json({error:"El código o SKU ya existe."},{status:409});
    if(error.code === "23503")return Response.json({error:"El registro tiene referencias o una relación ya no existe."},{status:409});
  }
  console.error(error);
  return Response.json({error:"No se pudo completar la operación."},{status:500});
}
