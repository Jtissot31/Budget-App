using BudgetTracker.Mobile.Services;
using BudgetTracker.Mobile.ViewModels;
using BudgetTracker.Mobile.Views.Pages;
using CommunityToolkit.Maui;
using Microsoft.Extensions.Logging;

namespace BudgetTracker.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .UseMauiCommunityToolkit();

        builder.Services.AddHttpClient<ApiBudgetService>(client =>
        {
            var baseUrl = Preferences.Default.Get("api_base_url", "https://localhost:7080");
            client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        builder.Services.AddSingleton<MockBudgetService>();
        builder.Services.AddSingleton<IBudgetService>(sp =>
        {
            if (Preferences.Default.Get("use_mock_data", true))
                return sp.GetRequiredService<MockBudgetService>();

            return sp.GetRequiredService<ApiBudgetService>();
        });

        builder.Services.AddTransient<DashboardViewModel>();
        builder.Services.AddTransient<TransactionsViewModel>();
        builder.Services.AddTransient<BudgetsViewModel>();
        builder.Services.AddTransient<AddTransactionViewModel>();
        builder.Services.AddTransient<SettingsViewModel>();

        builder.Services.AddTransient<DashboardPage>();
        builder.Services.AddTransient<TransactionsPage>();
        builder.Services.AddTransient<BudgetsPage>();
        builder.Services.AddTransient<AddTransactionPage>();
        builder.Services.AddTransient<SettingsPage>();
        builder.Services.AddSingleton<AppShell>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
