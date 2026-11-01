package tw.sunnycoop.widget;
import android.content.*;import android.webkit.CookieManager;import org.json.*;import javax.net.ssl.HttpsURLConnection;import java.net.URL;import java.io.*;import java.nio.charset.StandardCharsets;
final class CloudSync {
 static final String ORIGIN="https://fangyuan-flock-weather.a0321000000.chatgpt.site";
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("cloud",Context.MODE_PRIVATE);}
 static boolean active(Context c){return CoopWidget.prefs(c).getBoolean("cloudMode",false);}
 static String cookies(){return CookieManager.getInstance().getCookie(ORIGIN);}
 static JSONObject fetch(String cookies,String ua)throws Exception{
  if(cookies==null||cookies.isEmpty())throw new IOException("請登入晴舍後同步");
  HttpsURLConnection conn=(HttpsURLConnection)new URL(ORIGIN+"/api/coop/status").openConnection();conn.setConnectTimeout(15000);conn.setReadTimeout(15000);conn.setInstanceFollowRedirects(false);conn.setRequestProperty("Cookie",cookies);conn.setRequestProperty("Accept","application/json");if(ua!=null&&!ua.isEmpty())conn.setRequestProperty("User-Agent",ua);
  try{int code=conn.getResponseCode();String type=conn.getContentType();if(code!=200||type==null||!type.contains("application/json"))throw new IOException("登入過期／請重新登入並同步");try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n,total=0;while((n=in.read(b))!=-1){total+=n;if(total>524288)throw new IOException("雲端資料過大");out.write(b,0,n);}return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));}}finally{conn.disconnect();}
 }
 static JSONObject slim(JSONObject status)throws JSONException{return new JSONObject().put("config",status.getJSONObject("config")).put("weather",status.optJSONArray("weather")==null?new JSONArray():status.getJSONArray("weather")).put("lastRun",status.optLong("lastRun",0)).put("error",status.opt("error")).put("enabled",status.optBoolean("enabled"));}
 static void accept(Context c,JSONObject status)throws Exception{JSONObject data=slim(status);CloudModel.select(data,prefs(c).getString("siteId",""));prefs(c).edit().putString("data",data.toString()).apply();apply(c,data);}
 static void apply(Context c,JSONObject data)throws Exception{
  SharedPreferences p=prefs(c);CloudModel model=CloudModel.select(data,p.getString("siteId",""));JSONObject site=model.site,config=data.getJSONObject("config");SharedPreferences.Editor e=p.edit().putString("siteId",site.getString("id")).putString("name",site.getString("name")).putLong("fetched",System.currentTimeMillis()).putString("error","").putString("cloudState",data.optBoolean("enabled")?"雲端監測":"雲端監測未啟用").putLong("pauseUntil",config.optLong("pauseUntil",0));
  for(String key:new String[]{"high","low","wind","rain"}){JSONObject rule=config.getJSONObject("rules").getJSONObject(key);e.putBoolean(key+"On",rule.getBoolean("on")).putFloat(key,(float)rule.getDouble("value"));}
  String sector=config.optString("sector","");e.putInt("sector",sector.isEmpty()?-1:Integer.parseInt(sector)).putFloat("directionSpeed",(float)config.getDouble("directionSpeed"));
  if(model.observation==null)e.remove("snapshot").putString("error","場區無新資料／請到網頁更新");else{JSONObject v=model.observation;e.putString("snapshot",new JSONObject().put("source",v.opt("time")).put("temp",v.opt("temp")).put("wind",v.opt("wind")).put("dir",v.opt("direction")).put("rain",v.opt("rain")).toString());}
  e.apply();
 }
}
