using System.Text.RegularExpressions;
using SchoolAdmission.Application.Errors;

namespace SchoolAdmission.Application.Common;

public static class StudentIdValidator
{
    private static readonly Regex Regex = new(@"^\d{17}$", RegexOptions.Compiled);

    public static bool TryParse(string? studentId, out string validatedId)
    {
        if (!string.IsNullOrEmpty(studentId) && Regex.IsMatch(studentId))
        {
            validatedId = studentId;
            return true;
        }

        validatedId = string.Empty;
        return false;
    }

    public static string Validate(string? studentId)
    {
        if (TryParse(studentId, out var validatedId))
        {
            return validatedId;
        }

        throw new InvalidStudentIdException();
    }
}

