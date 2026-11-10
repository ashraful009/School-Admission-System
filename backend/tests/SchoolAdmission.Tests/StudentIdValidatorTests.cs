using SchoolAdmission.Application.Common;
using SchoolAdmission.Application.Errors;
using Xunit;

namespace SchoolAdmission.Tests;

public class StudentIdValidatorTests
{
    [Theory]
    [InlineData("12345678901234567")]
    [InlineData("00000000000000001")]
    [InlineData("99999999999999999")]
    public void TryParse_Valid17DigitString_ReturnsTrue(string validId)
    {
        var result = StudentIdValidator.TryParse(validId, out var validatedId);

        Assert.True(result);
        Assert.Equal(validId, validatedId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("1234567890123456")]     // 16 digits
    [InlineData("123456789012345678")]   // 18 digits
    [InlineData("1234567890123456a")]   // letter at end
    [InlineData("a2345678901234567")]   // letter at start
    [InlineData(" 12345678901234567 ")] // spaces
    [InlineData("12345678-01234567")]   // dash
    public void TryParse_InvalidString_ReturnsFalse(string? invalidId)
    {
        var result = StudentIdValidator.TryParse(invalidId, out var validatedId);

        Assert.False(result);
        Assert.Empty(validatedId);
    }

    [Fact]
    public void Validate_Valid17DigitString_ReturnsValidatedId()
    {
        const string input = "20081234567890123";
        var validated = StudentIdValidator.Validate(input);

        Assert.Equal(input, validated);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("abcdefghijklmnopq")]
    public void Validate_InvalidString_ThrowsInvalidStudentIdException(string? invalidId)
    {
        var ex = Assert.Throws<InvalidStudentIdException>(() => StudentIdValidator.Validate(invalidId));

        Assert.Equal(400, ex.StatusCode);
        Assert.Equal("INVALID_STUDENT_ID", ex.ErrorCode);
    }
}

