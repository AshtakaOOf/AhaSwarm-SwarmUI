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
}
