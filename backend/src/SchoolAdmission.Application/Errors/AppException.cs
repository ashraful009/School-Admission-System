namespace SchoolAdmission.Application.Errors;

public class AppException : Exception
{
    public int StatusCode { get; }
    public string ErrorCode { get; }

    public AppException(int statusCode, string errorCode, string message) : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

public class ValidationException : AppException
{
    public ValidationException(string message) 
        : base(400, "VALIDATION_ERROR", message) { }
}

public class InvalidStudentIdException : AppException
{
    public InvalidStudentIdException(string message = "The X-Student-Id header is missing or invalid. It must be exactly 17 digits.") 
        : base(400, "INVALID_STUDENT_ID", message) { }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message = "The requested resource was not found.") 
        : base(404, "NOT_FOUND", message) { }
}

public class ConflictException : AppException
{
    public ConflictException(string errorCode, string message) 
        : base(409, errorCode, message) { }
}

