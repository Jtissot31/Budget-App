using BudgetTracker.Mobile.Models;
using BudgetTracker.Mobile.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace BudgetTracker.Mobile.ViewModels;

[QueryProperty(nameof(PreselectedType), "type")]
public partial class AddTransactionViewModel(IBudgetService budgetService) : ObservableObject
{
    [ObservableProperty]
    private string _label = string.Empty;

    [ObservableProperty]
    private string _amountText = string.Empty;

    [ObservableProperty]
    private DateTime _date = DateTime.Today;

    [ObservableProperty]
    private TransactionType _selectedType = TransactionType.Expense;

    [ObservableProperty]
    private List<Category> _categories = [];

    [ObservableProperty]
    private Category? _selectedCategory;

    [ObservableProperty]
    private bool _isSaving;

    public string PreselectedType
    {
        set => SelectedType = value == "income" ? TransactionType.Income : TransactionType.Expense;
    }

    [RelayCommand]
    private void SetExpense() => SelectedType = TransactionType.Expense;

    [RelayCommand]
    private void SetIncome() => SelectedType = TransactionType.Income;

    [RelayCommand]
    public async Task InitializeAsync()
    {
        Categories = (await budgetService.GetCategoriesAsync()).ToList();
        SelectedCategory = Categories.FirstOrDefault(c =>
            SelectedType == TransactionType.Income
                ? c.Name == "Revenus"
                : c.Name != "Revenus");
    }

    [RelayCommand]
    public async Task SaveAsync()
    {
        if (IsSaving || SelectedCategory is null)
            return;

        if (string.IsNullOrWhiteSpace(Label))
        {
            await Shell.Current.DisplayAlert("Champ requis", "Indiquez un libellé.", "OK");
            return;
        }

        if (!decimal.TryParse(AmountText.Replace(',', '.'), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var amount) || amount <= 0)
        {
            await Shell.Current.DisplayAlert("Montant invalide", "Saisissez un montant positif.", "OK");
            return;
        }

        try
        {
            IsSaving = true;
            var draft = new Transaction
            {
                Id = Guid.Empty,
                Label = Label.Trim(),
                Amount = amount,
                Type = SelectedType,
                Date = Date,
                Category = SelectedCategory
            };

            await budgetService.AddTransactionAsync(draft);
            await Shell.Current.GoToAsync("..");
        }
        finally
        {
            IsSaving = false;
        }
    }
}
