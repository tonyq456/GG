package tw.sunnycoop.widget;
import org.junit.Test;import static org.junit.Assert.*;import org.json.*;
public class CloudModelTest {
 private JSONObject data()throws Exception{return new JSONObject("{\"config\":{\"sites\":[{\"id\":\"a\",\"name\":\"同名\"},{\"id\":\"b\",\"name\":\"同名\"}]},\"weather\":[{\"siteId\":\"b\",\"site\":\"同名\",\"temp\":31}]}");}
 @Test public void usesStableIdForDuplicateNames()throws Exception{CloudModel m=CloudModel.select(data(),"b");assertEquals("b",m.site.getString("id"));assertEquals(31,m.observation.getInt("temp"));assertNull(CloudModel.select(data(),"a").observation);}
 @Test public void removedSiteFallsBackWithoutUsingWrongWeather()throws Exception{CloudModel m=CloudModel.select(data(),"removed");assertEquals("a",m.site.getString("id"));assertNull(m.observation);}
 @Test public void legacyAmbiguousNamesDoNotMixSites()throws Exception{JSONObject d=data();d.getJSONArray("weather").getJSONObject(0).remove("siteId");assertNull(CloudModel.select(d,"b").observation);}
 @Test public void emptyWeatherKeepsSiteButNoCurrentValues()throws Exception{JSONObject d=data();d.put("weather",new JSONArray());assertNull(CloudModel.select(d,"b").observation);}
}
