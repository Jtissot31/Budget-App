using System.Globalization;
using BudgetTracker.Mobile.Models;

namespace BudgetTracker.Mobile.Converters;

public sealed class TransactionSignConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not TransactionType type)
            return string.Empty;

        return type == TransactionType.Income ? "+" : "−";
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
