using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.Core;
using SwarmUI.Utils;
using SwarmUI.WebAPI;
using System.Collections.Concurrent;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace AhaSwarmExtension;

public static class AhaSettingsAPI
{
    public static void Register()
    {
        API.RegisterAPICall(AhaGetSettings, false, Permissions.ReadUserSettings);
        API.RegisterAPICall(AhaSaveSettings, true, Permissions.EditUserSettings);
        API.RegisterAPICall(AhaGetInstallFeatures, false, Permissions.FundamentalGenerateTabAccess);
    }

    public const int MaxSettingsLength = 256 * 1024;

    public static string UsersFolder => Utilities.CombinePathWithAbsolute(Program.DataDir, "AhaSwarm/users");

    private static readonly ConcurrentDictionary<string, object> Locks = new();

    private static readonly Regex SafeId = new("^[a-z0-9_-]{1,64}$", RegexOptions.Compiled);

    /// <summary>file name for a user: the user id when it is already a safe name, otherwise a hash of it</summary>
    public static string FileFor(string userId)
    {
        string id = (userId ?? "").ToLowerInvariant();
        if (!SafeId.IsMatch(id))
        {
            id = "u_" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(userId ?? ""))).ToLowerInvariant()[..32];
        }
        return Path.Combine(UsersFolder, $"{id}.json");
    }

    private static object LockFor(string path) => Locks.GetOrAdd(path, _ => new object());

    [API.APIDescription("Returns the current user's AhaSwarm settings (null if none were saved yet).", "\"settings\": { ... }")]
    public static async Task<JObject> AhaGetSettings(Session session)
    {
        string path = FileFor(session.User.UserID);
        string raw = null;
        lock (LockFor(path))
        {
            if (File.Exists(path))
            {
                raw = File.ReadAllText(path);
            }
        }
        JObject settings = null;
        if (!string.IsNullOrWhiteSpace(raw))
        {
            try { settings = JObject.Parse(raw); }
            catch (Exception ex) { Logs.Warning($"AhaSwarm: '{path}' is not valid JSON, ignoring it: {ex.Message}"); }
        }
        return new JObject() { ["settings"] = settings };
    }

    [API.APIDescription("Saves the current user's AhaSwarm settings.", "\"success\": true")]
    public static async Task<JObject> AhaSaveSettings(Session session,
        [API.APIParameter("The AhaSwarm settings, as a JSON object string.")] string settings)
    {
        if (settings is null || settings.Length > MaxSettingsLength)
        {
            return new JObject() { ["error"] = "Settings are missing or too large." };
        }
        JObject parsed;
        try { parsed = JObject.Parse(settings); }
        catch (Exception) { return new JObject() { ["error"] = "Settings must be a JSON object." }; }
        string path = FileFor(session.User.UserID);
        lock (LockFor(path))
        {
            Directory.CreateDirectory(UsersFolder);
            string tmp = $"{path}.{Guid.NewGuid():N}.tmp";
            File.WriteAllText(tmp, parsed.ToString(Newtonsoft.Json.Formatting.Indented));
            File.Move(tmp, path, true);
        }
        return new JObject() { ["success"] = true };
    }

    private static readonly Regex InstallButtonCall = new(
        @"(?://[^\r\n]*|/\*[\s\S]*?\*/)|\baddInstallButton\s*\(\s*(['""`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(['""`])((?:\\.|(?!\3)[^\\])*)\3\s*,\s*(['""`])((?:\\.|(?!\5)[^\\])*)\5\s*,\s*(['""`])((?:\\.|(?!\7)[^\\])*)\7\s*\)",
        RegexOptions.Compiled);

    private static string UnescapeJsString(string value)
    {
        if (string.IsNullOrEmpty(value) || !value.Contains('\\'))
        {
            return value;
        }
        return Regex.Replace(value, @"\\([\\'""`nrt])", m => m.Groups[1].Value switch
        {
            "n" => "\n",
            "r" => "\r",
            "t" => "\t",
            _ => m.Groups[1].Value,
        });
    }

    [API.APIDescription("Returns ComfyUI installable features and extension param-group install buttons.", "\"features\": { ... }, \"buttons\": [ ... ]")]
    public static async Task<JObject> AhaGetInstallFeatures(Session session)
    {
        JObject features = [];
        foreach (InstallableFeatures.ComfyInstallableFeature f in InstallableFeatures.ComfyFeatures.Values.ToArray())
        {
            features[f.ID] = new JObject
            {
                ["id"] = f.ID,
                ["display_name"] = f.DisplayName,
                ["url"] = f.URL,
                ["author"] = f.Author,
                ["notice"] = f.Notice,
            };
        }
        JArray buttons = [];
        HashSet<string> seen = new(StringComparer.Ordinal);
        Program.Extensions.RunOnAllExtensions(ext =>
        {
            foreach (string script in ext.ScriptFiles)
            {
                string full = Path.Combine(ext.FilePath, script);
                if (!File.Exists(full))
                {
                    continue;
                }
                string text;
                try { text = File.ReadAllText(full); }
                catch (IOException) { continue; }
                foreach (Match m in InstallButtonCall.Matches(text))
                {
                    if (!m.Groups[2].Success)
                    {
                        continue;
                    }
                    string groupId = UnescapeJsString(m.Groups[2].Value);
                    string featureId = UnescapeJsString(m.Groups[4].Value);
                    string installId = UnescapeJsString(m.Groups[6].Value);
                    string label = UnescapeJsString(m.Groups[8].Value);
                    if (seen.Add($"{groupId}\0{featureId}\0{installId}"))
                    {
                        buttons.Add(new JObject
                        {
                            ["group_id"] = groupId,
                            ["feature_id"] = featureId,
                            ["install_id"] = installId,
                            ["label"] = label,
                        });
                    }
                }
            }
        });
        return new JObject { ["features"] = features, ["buttons"] = buttons };
    }
}
