using System.Globalization;
using BudgetTracker.Mobile.Models;

namespace BudgetTracker.Mobile.Converters;

public sealed class TransactionAmountColorConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not TransactionType type)
            return Colors.White;

        return type == TransactionType.Income
            ? Color.FromArgb("#34D399")
            : Color.FromArgb("#F87171");
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
