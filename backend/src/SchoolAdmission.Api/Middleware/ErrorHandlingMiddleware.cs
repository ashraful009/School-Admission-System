using System.Text.Json;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;

namespace SchoolAdmission.Api.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);

            if (!context.Response.HasStarted)
            {
                if (context.Response.StatusCode == StatusCodes.Status404NotFound)
                {
                    await WriteErrorResponseAsync(context, StatusCodes.Status404NotFound, "NOT_FOUND", "The requested endpoint or resource was not found.");
                }
                else if (context.Response.StatusCode == StatusCodes.Status405MethodNotAllowed)
                {
                    await WriteErrorResponseAsync(context, StatusCodes.Status405MethodNotAllowed, "METHOD_NOT_ALLOWED", $"The HTTP {context.Request.Method} method is not allowed for this endpoint.");
                }
                else if (context.Response.StatusCode == StatusCodes.Status415UnsupportedMediaType)
                {
                    await WriteErrorResponseAsync(context, StatusCodes.Status415UnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
                }
            }
        }
        catch (AppException ex)
        {
            await WriteErrorResponseAsync(context, ex.StatusCode, ex.ErrorCode, ex.Message);
        }
        catch (BadHttpRequestException ex)
        {
            _logger.LogWarning(ex, "Bad HTTP request: {Message}", ex.Message);
            await WriteErrorResponseAsync(context, StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "The request body is malformed or contains invalid JSON.");
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "JSON deserialization failed: {Message}", ex.Message);
            await WriteErrorResponseAsync(context, StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "The request body is malformed or contains invalid JSON.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred while processing request {Path}", context.Request.Path);
            await WriteErrorResponseAsync(context, StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
        }
    }

    private static async Task WriteErrorResponseAsync(HttpContext context, int statusCode, string errorCode, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var body = new ErrorResponse(new ErrorDetail(errorCode, message));
        await context.Response.WriteAsync(JsonSerializer.Serialize(body));
    }
}

