using BudgetTracker.Mobile.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace BudgetTracker.Mobile.ViewModels;

public partial class SettingsViewModel(IBudgetService budgetService) : ObservableObject
{
    private const string ApiUrlKey = "api_base_url";

    [ObservableProperty]
    private string _apiBaseUrl = "https://localhost:7080";

    [ObservableProperty]
    private bool _useMockData = true;

    [RelayCommand]
    public void Load()
    {
        ApiBaseUrl = Preferences.Default.Get(ApiUrlKey, budgetService.ApiBaseUrl);
        UseMockData = Preferences.Default.Get("use_mock_data", true);
    }

    [RelayCommand]
    public async Task SaveAsync()
    {
        Preferences.Default.Set(ApiUrlKey, ApiBaseUrl.Trim());
        Preferences.Default.Set("use_mock_data", UseMockData);
        budgetService.ApiBaseUrl = ApiBaseUrl.Trim();
        await Shell.Current.DisplayAlert("Enregistré", "Les paramètres ont été mis à jour.", "OK");
    }
}
