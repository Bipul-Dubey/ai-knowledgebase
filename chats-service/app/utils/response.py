def APIResponse(error: bool, message: str, data: any = None, status_code: int = 200):
    return {
        "error": error,
        "message": message,
        "status": status_code,
        "data": data
    }