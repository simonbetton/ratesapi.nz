import { apiError, invalidRequestParameters } from "../models/api";
import type { ApiErrorBody, ApiErrorCode } from "../models/api";

export interface ApiResult<T = unknown> {
  status: number;
  body: T;
}

export function apiResult<T>(status: number, body: T): ApiResult<T> {
  return { status, body };
}

// The HTTP status of an error result is the `code` of its body.
export function errorResult(body: ApiErrorBody): ApiResult<ApiErrorBody> {
  return apiResult(body.code, body);
}

export function apiErrorResult(
  error: ApiErrorCode,
  message: string
): ApiResult<ApiErrorBody> {
  return errorResult(apiError(error, message));
}

export function invalidRequestResult(): ApiResult<ApiErrorBody> {
  return errorResult(invalidRequestParameters());
}

export function jsonResult(result: ApiResult): Response {
  return Response.json(result.body, {
    status: result.status,
  });
}
