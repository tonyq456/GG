package tw.sunnycoop.widget;
import org.junit.Test;import static org.junit.Assert.*;
public class RulesTest {
 @Test public void inclusiveThresholds(){assertTrue(Rules.high(32,32,true));assertTrue(Rules.low(15,15,true));assertFalse(Rules.high(32,32,false));assertFalse(Rules.high(Double.NaN,32,true));}
 @Test public void directionWraparound(){assertTrue(Rules.direction(359,8,0,8));assertFalse(Rules.direction(30,8,0,8));assertFalse(Rules.direction(359,7,0,8));assertEquals("北",Rules.compass(359));}
}
