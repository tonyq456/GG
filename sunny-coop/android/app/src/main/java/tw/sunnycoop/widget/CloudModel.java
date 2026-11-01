package tw.sunnycoop.widget;
import org.json.*;
final class CloudModel {
 final JSONObject site,observation;
 CloudModel(JSONObject site,JSONObject observation){this.site=site;this.observation=observation;}
 static CloudModel select(JSONObject data,String selected)throws JSONException{
  JSONArray sites=data.getJSONObject("config").getJSONArray("sites");if(sites.length()==0)throw new JSONException("請先在網頁儲存場區");JSONObject site=sites.getJSONObject(0);
  for(int i=0;i<sites.length();i++)if(sites.getJSONObject(i).getString("id").equals(selected)){site=sites.getJSONObject(i);break;}
  JSONArray weather=data.optJSONArray("weather");JSONObject match=null;int sameNames=0;
  for(int i=0;i<sites.length();i++)if(sites.getJSONObject(i).getString("name").equals(site.getString("name")))sameNames++;
  if(weather!=null)for(int i=0;i<weather.length();i++){JSONObject v=weather.getJSONObject(i);if(v.optString("siteId").equals(site.getString("id"))||(v.optString("siteId").isEmpty()&&sameNames==1&&v.optString("site").equals(site.getString("name")))){if(v.has("lat")&&v.has("lon")&&(v.optDouble("lat")!=site.optDouble("lat")||v.optDouble("lon")!=site.optDouble("lon")))continue;match=v;break;}}
  return new CloudModel(site,match);
 }
}
