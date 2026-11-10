using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Html;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.Core;
using SwarmUI.Utils;
using SwarmUI.WebAPI;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;

namespace AhaSwarmExtension;

public class AhaSwarm : Extension
{
    public const string AppFolder = "Assets/app";

    public const string DevServerUrl = "http://localhost:5173";

    private static readonly HttpClient DevClient = new(new SocketsHttpHandler
    {
        // the proxy forwards cookies itself; don't let the handler keep a second cookie jar
        UseCookies = false,
        AllowAutoRedirect = true,
        AutomaticDecompression = DecompressionMethods.All,
    })
    {
        Timeout = TimeSpan.FromMinutes(5),
    };

    private static readonly HashSet<string> SkippedRequestHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Host", "Connection", "Transfer-Encoding", "Upgrade", "Accept-Encoding", "Content-Type", "Content-Length",
        "Cookie", "Authorization",
    };

    private static readonly HashSet<string> SkippedResponseHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Transfer-Encoding", "Content-Encoding", "Content-Length", "Connection", "Keep-Alive", "Upgrade",
    };

    public const int MaxCustomThemes = 64, MaxCustomThemeBytes = 512 * 1024;

    private static readonly Regex CustomThemeId = new("^[a-z0-9][a-z0-9_-]*$", RegexOptions.IgnoreCase);

    public override void OnInit()
    {
        Logs.Init("AhaSwarm: registering frontend at /Aha/ (Vite dev server at /Ahadev/)");
        ScriptFiles.Add("Assets/aha-tab.js");
        OtherAssets.Add("Assets/aha-login.js");
        AhaSettingsAPI.Register();
    }

    public static string CustomThemesFolder => Utilities.CombinePathWithAbsolute(Program.DataDir, "AhaSwarm/themes");

    public static string CustomThemesJson()
    {
        string dir = CustomThemesFolder;
        if (!Directory.Exists(dir))
        {
            return null;
        }
        JArray list = [];
        foreach (string file in Directory.EnumerateFiles(dir, "*.css").OrderBy(f => f, StringComparer.OrdinalIgnoreCase).Take(MaxCustomThemes))
        {
            string id = Path.GetFileNameWithoutExtension(file);
            if (!CustomThemeId.IsMatch(id) || new FileInfo(file).Length > MaxCustomThemeBytes)
            {
                Logs.Warning($"AhaSwarm: skipping custom theme '{file}' (name must be letters, digits, '-' or '_'; at most {MaxCustomThemeBytes / 1024} KiB)");
                continue;
            }
            list.Add(new JObject() { ["id"] = id, ["css"] = File.ReadAllText(file) });
        }
        // "</" escaped so the JSON can't close its <script> tag
        return list.Count == 0 ? null : list.ToString(Newtonsoft.Json.Formatting.None).Replace("</", "<\\/");
    }

    public override void OnPreLaunch()
    {
        string root = Path.GetFullPath($"{FilePath}{AppFolder}").Replace('\\', '/');
        if (!File.Exists($"{root}/index.html"))
        {
            Logs.Warning($"AhaSwarm: '{root}/index.html' is missing. Build the frontend first: cd frontend && npm ci && npm run build");
        }
        WebServer.WebApp.MapGet("/Aha", async context =>
        {
            if (!(context.Request.Path.Value ?? "").EndsWith('/'))
            {
                context.Response.Redirect($"{context.Request.PathBase}/Aha/{context.Request.QueryString}");
                return;
            }
            await ServeAsset(context, root, "index.html");
        });
        WebServer.WebApp.MapGet("/Aha/{*asset}", async context =>
        {
            string asset = context.Request.RouteValues["asset"]?.ToString() ?? "";
            await ServeAsset(context, root, string.IsNullOrWhiteSpace(asset) ? "index.html" : asset);
        });
        MapDevServer();
        AddLaunchModeOption();
        LaunchBrowserIfAsked();
        WebServer.PageHeaderExtra = new HtmlString($"{WebServer.PageHeaderExtra}<script defer src=\"ExtensionFile/{ExtensionName}/Assets/aha-login.js?vary={Utilities.VaryID}\"></script>");
    }

    /// <summary>launch modes that open AhaSwarm in the browser instead of the classic UI</summary>
    public static readonly string[] AhaLaunchModes = ["aha", "web-aha"];

    private static void AddLaunchModeOption()
    {
        if (!API.APIHandlers.TryGetValue("listserversettings", out APICall call))
        {
            Logs.Warning("AhaSwarm: ListServerSettings is not registered; the 'aha' launch mode won't be listed in Server Configuration.");
            return;
        }
        Func<HttpContext, Session, System.Net.WebSockets.WebSocket, JObject, Task<JObject>> original = call.Call;
        API.APIHandlers["listserversettings"] = call with
        {
            Call = async (context, session, socket, input) =>
            {
                JObject result = await original(context, session, socket, input);
                if (result?["settings"] is JObject settings && settings.Properties().FirstOrDefault(p => p.Name.Equals("LaunchMode", StringComparison.OrdinalIgnoreCase))?.Value is JObject mode
                    && mode["values"] is JArray values && !values.Any(v => $"{v}" == "aha"))
                {
                    values.Add("aha");
                    if (mode["value_names"] is JArray names)
                    {
                        names.Add("aha");
                    }
                    mode["description"] = $"{mode["description"]}\nIf 'aha', launch your web-browser to the AhaSwarm page (/Aha/).";
                }
                return result;
            }
        };
    }

    private static void LaunchBrowserIfAsked()
    {
        if (Program.IsCiTest || !AhaLaunchModes.Contains((Program.LaunchMode ?? "").Trim().ToLowerInvariant()))
        {
            return;
        }
        Task.Run(async () =>
        {
            await Task.Delay(1000);
            try
            {
                Logs.Init("AhaSwarm: launch web browser to /Aha/...");
                Process.Start(new ProcessStartInfo($"{WebServer.PageURL}/Aha/") { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Logs.Error($"AhaSwarm: failed to open the browser (on a headless/server install, use '--launch_mode none'): {ex.ReadableString()}");
            }
        });
    }

    private static void MapDevServer()
    {
        WebServer.WebApp.MapGet("/Ahadev", async context =>
        {
            if (!(context.Request.Path.Value ?? "").EndsWith('/'))
            {
                context.Response.Redirect($"{context.Request.PathBase}/Ahadev/{context.Request.QueryString}");
                return;
            }
            await ProxyDev(context);
        });
        WebServer.WebApp.Map("/Ahadev/{*asset}", ProxyDev);
    }

    /// <summary>forwards one request to the Vite dev server and streams the response back</summary>
    private static async Task ProxyDev(HttpContext context)
    {
        if (context.Connection.RemoteIpAddress is { } ip && !System.Net.IPAddress.IsLoopback(ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip))
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsync("404, file not found.");
            return;
        }
        string target = $"{DevServerUrl}{context.Request.Path}{context.Request.QueryString}";
        using HttpRequestMessage req = new(new HttpMethod(context.Request.Method), target);
        foreach (KeyValuePair<string, StringValues> h in context.Request.Headers)
        {
            if (!SkippedRequestHeaders.Contains(h.Key))
            {
                req.Headers.TryAddWithoutValidation(h.Key, h.Value.ToArray());
            }
        }
        if (context.Request.ContentLength > 0 || context.Request.Headers.ContainsKey("Transfer-Encoding"))
        {
            req.Content = new StreamContent(context.Request.Body);
            if (context.Request.ContentType is not null)
            {
                req.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(context.Request.ContentType);
            }
        }
        try
        {
            using HttpResponseMessage resp = await DevClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
            context.Response.StatusCode = (int)resp.StatusCode;
            foreach (KeyValuePair<string, IEnumerable<string>> h in resp.Headers.Concat(resp.Content.Headers))
            {
                if (!SkippedResponseHeaders.Contains(h.Key))
                {
                    context.Response.Headers[h.Key] = h.Value.ToArray();
                }
            }
            await resp.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
        }
        catch (Exception e)
        {
            Logs.Debug($"AhaSwarm dev proxy: {target} failed: {e.Message}");
            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = 502;
                await context.Response.WriteAsync($"AhaSwarm dev server is not reachable at {DevServerUrl}. Start it with: cd frontend && npm run dev");
            }
        }
    }

    public static async Task ServeAsset(HttpContext context, string root, string asset)
    {
        (string path, string consoleError, string userError) = WebServer.CheckFilePath(root, asset);
        if (consoleError is not null)
        {
            Logs.Error(consoleError);
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync(userError);
            return;
        }
        if (!File.Exists(path))
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsync("404, file not found.");
            return;
        }
        bool isIndex = path.EndsWith("index.html");
        context.Response.ContentType = isIndex ? "text/html; charset=utf-8" : Utilities.GuessContentType(path);
        // hashed build assets can be cached forever; index.html must always revalidate
        context.Response.Headers.CacheControl = isIndex ? "no-cache" : "public, max-age=31536000, immutable";
        string themes = isIndex ? CustomThemesJson() : null;
        if (themes is not null)
        {
            // custom themes ride along in the page (no extra request); the app registers them before mounting
            string html = await File.ReadAllTextAsync(path);
            int head = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
            string tag = $"<script type=\"application/json\" id=\"aha-custom-themes\">{themes}</script>";
            await context.Response.WriteAsync(head < 0 ? tag + html : html.Insert(head, tag));
            return;
        }
        await context.Response.SendFileAsync(path);
    }
}
