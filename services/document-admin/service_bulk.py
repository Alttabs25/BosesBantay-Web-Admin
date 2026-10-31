"""Explicit, bounded bulk controls; never call controller.start_all/stop_all (they include Expo)."""
def bulk_control(controller, action, set_ingestion):
    if action not in {'start','stop'}:
        raise ValueError('Unsupported action')
    order=['ollama','whisper','api'] if action=='start' else ['api','whisper','ollama']
    results=[]
    if action=='stop':
        set_ingestion(False)
        results.append({'service':'ingestion','ok':True,'message':'Ingestion paused.'})
    for service in order:
        try:
            message=getattr(controller,action)(service)
            results.append({'service':service,'ok':True,'message':message})
        except Exception:
            # Do not leak SDK/process payloads or interrupt the remaining actions.
            results.append({'service':service,'ok':False,'message':f'Could not {action} {service}. Check its logs and process ownership.'})
    if action=='start':
        set_ingestion(True)
        results.append({'service':'ingestion','ok':True,'message':'Ingestion enabled.'})
    complete=all(item['ok'] for item in results)
    return {'ok':complete,'message':('Start requests completed. Check readiness below.' if action=='start' else 'Stop requests completed.') if complete else 'Some actions could not complete. Review the service details below.','results':results}
