import { invalidRequestParameters } from "../models/api";

export type ApiResult<T = unknown> = {
  status: number;
  body: T;
};

export function apiResult<T>(status: number, body: T): ApiResult<T> {
  return { status, body };
}

export function invalidRequestResult(): ApiResult<
  ReturnType<typeof invalidRequestParameters>
> {
  return apiResult(400, invalidRequestParameters());
}

export function jsonResult(result: ApiResult): Response {
  return Response.json(result.body, {
    status: result.status,
  });
}
